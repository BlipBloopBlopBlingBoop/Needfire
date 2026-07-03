# Needfire — run-anywhere container. Pure stdlib app, so the image is tiny.
FROM python:3.12-slim

# No pip dependencies — the app uses only the Python standard library.
WORKDIR /opt/needfire
COPY needfire ./needfire
COPY web ./web
COPY seed-corpus ./seed-corpus
COPY catalog ./catalog

ENV NEEDFIRE_HOME=/data \
    NEEDFIRE_WEB_DIR=/opt/needfire/web \
    NEEDFIRE_SEED_DIR=/opt/needfire/seed-corpus \
    NEEDFIRE_CATALOG=/opt/needfire/catalog/catalog.json \
    NEEDFIRE_HOST=0.0.0.0 \
    NEEDFIRE_PORT=8848 \
    NEEDFIRE_OLLAMA_URL=http://host.docker.internal:11434

# Build the seed index at image build so the container answers immediately.
# This must happen BEFORE the VOLUME declaration: writes to a declared volume
# path in later layers are discarded by Docker.
RUN python3 -m needfire index

VOLUME /data
EXPOSE 8848

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8848/api/health',timeout=2).status==200 else 1)" || exit 1

CMD ["sh", "-c", "[ -f \"$NEEDFIRE_HOME/index/chunks.sqlite\" ] || python3 -m needfire index; exec python3 -m needfire serve"]
