"""SQLite helpers for the chunk store and vector index.

Uses only the stdlib `sqlite3`. Full-text search uses FTS5 when the local SQLite
build includes it (the common case); otherwise retrieval falls back to LIKE
scans (see rag.py). Vectors are stored as raw float32 BLOBs so brute-force
cosine search needs no third-party library.
"""
import sqlite3
import struct
from . import config

# Bumped when the on-disk layout changes; index.build() stamps it into meta so
# the server can tell an old index needs a rebuild.
SCHEMA_VERSION = 2


def connect(path=None):
    conn = sqlite3.connect(str(path or config.CHUNK_DB))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def fts5_available(conn):
    try:
        conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS _fts_probe USING fts5(x)")
        conn.execute("DROP TABLE IF EXISTS _fts_probe")
        return True
    except sqlite3.OperationalError:
        return False


def init_schema(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id   INTEGER PRIMARY KEY,
            doc_id     TEXT NOT NULL,
            doc_title  TEXT,
            tier       TEXT,
            domain     TEXT,
            license    TEXT,
            word_start INTEGER,
            text       TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_domain ON chunks(domain);
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

        CREATE TABLE IF NOT EXISTS docs (
            doc_id  TEXT PRIMARY KEY,
            title   TEXT,
            domain  TEXT,
            tier    TEXT,
            license TEXT,
            text    TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_docs_domain ON docs(domain);

        CREATE TABLE IF NOT EXISTS vectors (
            chunk_id INTEGER PRIMARY KEY,
            dims     INTEGER NOT NULL,
            vec      BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """
    )
    if fts5_available(conn):
        conn.executescript(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                text, doc_title, domain, content='chunks', content_rowid='chunk_id'
            );
            """
        )
    conn.commit()


def reset_content(conn):
    """Clear chunk/vector/doc content for a full rebuild (keeps schema)."""
    conn.execute("DELETE FROM chunks")
    conn.execute("DELETE FROM vectors")
    conn.execute("DELETE FROM docs")
    if has_fts(conn):
        conn.execute("DELETE FROM chunks_fts")
    conn.commit()


def has_fts(conn):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chunks_fts'"
    ).fetchone()
    return row is not None


def insert_chunk(conn, doc_id, doc_title, tier, domain, license_, word_start, text):
    cur = conn.execute(
        "INSERT INTO chunks(doc_id,doc_title,tier,domain,license,word_start,text)"
        " VALUES (?,?,?,?,?,?,?)",
        (doc_id, doc_title, tier, domain, license_, word_start, text),
    )
    chunk_id = cur.lastrowid
    if has_fts(conn):
        conn.execute(
            "INSERT INTO chunks_fts(rowid, text, doc_title, domain) VALUES (?,?,?,?)",
            (chunk_id, text, doc_title or "", domain or ""),
        )
    return chunk_id


def insert_doc(conn, doc_id, title, domain, tier, license_, text):
    conn.execute(
        "INSERT OR REPLACE INTO docs(doc_id,title,domain,tier,license,text)"
        " VALUES (?,?,?,?,?,?)",
        (doc_id, title, domain, tier, license_, text),
    )


def list_docs(conn, domain=None):
    """Document cards (no body text) for category listings."""
    sql = "SELECT doc_id, title, domain, tier, license, length(text) AS chars FROM docs"
    params = []
    if domain:
        sql += " WHERE domain = ?"
        params.append(domain)
    sql += " ORDER BY title"
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def pack_vector(vec):
    return struct.pack(f"<{len(vec)}f", *vec)


def unpack_vector(blob, dims):
    return list(struct.unpack(f"<{dims}f", blob))


def insert_vector(conn, chunk_id, vec):
    conn.execute(
        "INSERT OR REPLACE INTO vectors(chunk_id, dims, vec) VALUES (?,?,?)",
        (chunk_id, len(vec), pack_vector(vec)),
    )


def set_meta(conn, key, value):
    conn.execute("INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)", (key, str(value)))


def get_meta(conn, key, default=None):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def stats(conn):
    n_chunks = conn.execute("SELECT COUNT(*) c FROM chunks").fetchone()["c"]
    n_vecs = conn.execute("SELECT COUNT(*) c FROM vectors").fetchone()["c"]
    by_domain = {
        r["domain"]: r["c"]
        for r in conn.execute(
            "SELECT domain, COUNT(*) c FROM chunks GROUP BY domain"
        ).fetchall()
    }
    n_docs = conn.execute("SELECT COUNT(*) c FROM docs").fetchone()["c"]
    if not n_docs:  # legacy index without a docs table population
        n_docs = conn.execute(
            "SELECT COUNT(DISTINCT doc_id) c FROM chunks").fetchone()["c"]
    return {
        "chunks": n_chunks,
        "vectors": n_vecs,
        "documents": n_docs,
        "by_domain": by_domain,
    }
