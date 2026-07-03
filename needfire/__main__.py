"""Command-line entrypoint:  python3 -m needfire <command>

Commands:
  serve     Start the web server + API (default).
  index     Build the search index from the seed corpus + NEEDFIRE_HOME content.
  ask       Ask a question from the CLI (no server needed).
  download  Download corpus sources by --tier or --id (network).
  verify    Re-hash the corpus against the manifest.
  status    Print system/power + corpus stats as JSON.
"""
import argparse
import json
import sys

from . import __version__, config, corpus, db, models, power, rag, router


def cmd_serve(args):
    from . import server
    server.serve(host=args.host, port=args.port)


def cmd_index(args):
    from . import index
    index.build(include_seed=not args.no_seed, embed_backend=args.embed_backend)


def cmd_ask(args):
    conn = db.connect()
    db.init_schema(conn)
    question = " ".join(args.question)
    category, force_cite, domain = router.classify(question)
    chunks, how = rag.retrieve(conn, question, domain=domain)
    print(f"[category={category} critical={force_cite} retrieval={how} "
          f"sources={len(chunks)}]\n")
    if not chunks:
        print("Not in the available sources.")
        return
    model = router.pick_model(category, force_cite, "normal", models.available())
    if model:
        prompt = router.build_prompt(question, chunks, force_cite)
        try:
            for tok in models.generate_stream(prompt, model=model):
                sys.stdout.write(tok)
                sys.stdout.flush()
            print("\n")
        except Exception as exc:  # noqa: BLE001
            print(f"(model error: {exc}; sources only)\n")
    else:
        print("(no model loaded — sources only)\n")
    print("Sources (open to verify):")
    for i, c in enumerate(chunks, 1):
        print(f"  [{i}] {c['doc_title']} — {c['doc_id']} ({c['domain']}, {c['license']})")
    if force_cite:
        print("\n!! Survival-critical: READ the cited source before acting.")


def cmd_download(args):
    ids = args.id or []
    if args.tier:
        ids += [s["id"] for s in corpus.load_catalog() if s.get("tier") in args.tier]
    if not ids:
        print("Nothing selected. Use --tier C1 or --id <source-id>.")
        print("Catalog:")
        for s in corpus.load_catalog():
            print(f"  {s['id']:30} {s.get('tier'):4} {s.get('title')}")
        return
    print(f"Downloading: {', '.join(ids)}")
    corpus.JOB.start(ids)
    import time
    while True:
        snap = corpus.JOB.snapshot()
        for sid, st in snap["items"].items():
            tot = st["total"] or 0
            pct = (100 * st["bytes"] / tot) if tot else 0
            print(f"  {sid:30} {st['state']:12} {pct:5.1f}%  {st.get('error') or ''}")
        if not snap["active"]:
            break
        time.sleep(1.0)


def cmd_verify(args):
    report = corpus.verify_seed() if args.seed else corpus.verify()
    print(json.dumps(report, indent=2))
    if report["changed"] or report["missing"]:
        sys.exit(1)


def cmd_status(args):
    conn = db.connect(); db.init_schema(conn)
    out = power.snapshot()
    out["models"] = {"available": models.available(), "installed": models.list_models()}
    out["corpus"] = db.stats(conn)
    print(json.dumps(out, indent=2))


def build_parser():
    p = argparse.ArgumentParser(prog="needfire", description="Needfire — offline survival computer")
    p.add_argument("--version", action="version", version=f"Needfire {__version__}")
    sub = p.add_subparsers(dest="command")

    s = sub.add_parser("serve", help="run the web server")
    s.add_argument("--host", default=config.HOST)
    s.add_argument("--port", type=int, default=config.PORT)
    s.set_defaults(func=cmd_serve)

    s = sub.add_parser("index", help="build the search index")
    s.add_argument("--no-seed", action="store_true", help="skip the bundled seed corpus")
    s.add_argument("--embed-backend", choices=["hash", "ollama"], default=None)
    s.set_defaults(func=cmd_index)

    s = sub.add_parser("ask", help="ask from the CLI")
    s.add_argument("question", nargs="+")
    s.set_defaults(func=cmd_ask)

    s = sub.add_parser("download", help="download corpus sources")
    s.add_argument("--tier", action="append", help="C1/C2/C3/C4 (repeatable)")
    s.add_argument("--id", action="append", help="catalog source id (repeatable)")
    s.set_defaults(func=cmd_download)

    s = sub.add_parser("verify", help="verify corpus integrity")
    s.add_argument("--seed", action="store_true",
                   help="verify the bundled seed docs against seed-manifest.json")
    s.set_defaults(func=cmd_verify)

    s = sub.add_parser("status", help="print system + corpus status")
    s.set_defaults(func=cmd_status)
    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None):
        args.command = "serve"
        args.host, args.port = config.HOST, config.PORT
        return cmd_serve(args)
    return args.func(args)


if __name__ == "__main__":
    main()
