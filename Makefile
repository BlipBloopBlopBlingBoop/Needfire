# Needfire — developer + operator convenience targets.
# The app needs only python3; these targets wrap the common workflows.

PY ?= python3
PORT ?= 8848
TARGET ?= pi
VERSION = $(shell $(PY) -c "import needfire; print(needfire.__version__)")

.PHONY: help index serve ask status test seed-manifest icons dist docker docker-run image-pi image-x86 image-docker clean

help:
	@echo "Needfire — make targets:"
	@echo "  make index     Build the search index from the seed corpus (+ NEEDFIRE_HOME)"
	@echo "  make serve     Run the web server on port $(PORT)  (http://localhost:$(PORT))"
	@echo "  make ask Q='…' Ask a question from the CLI"
	@echo "  make status    Print system + corpus status as JSON"
	@echo "  make test      Run the stdlib test suite"
	@echo "  make seed-manifest  Recompute seed-corpus hashes after editing docs"
	@echo "  make icons     Regenerate the PWA raster icons"
	@echo "  make dist      Build dist/needfire-<version>.zip — the shareable one-folder package"
	@echo "  make docker    Build the Docker image"
	@echo "  make docker-run  Run the container on port $(PORT)"
	@echo "  make image-pi  Build a Raspberry Pi appliance image (needs root/tools)"
	@echo "  make image-x86 Build an x86 appliance image (needs root/tools)"
	@echo "  make image-docker TARGET=pi|x86   Build an appliance image via Docker (works on Windows/Mac)"
	@echo "  make clean     Remove the local runtime data (.needfire-home)"

index:
	$(PY) -m needfire index

serve:
	NEEDFIRE_PORT=$(PORT) $(PY) -m needfire serve

ask:
	@$(PY) -m needfire ask "$(Q)"

status:
	@$(PY) -m needfire status

test:
	$(PY) -m unittest discover -s tests -v

seed-manifest:
	$(PY) scripts/update-seed-manifest.py

dist:
	$(PY) scripts/make-dist.py

icons:
	$(PY) scripts/make-icons.py

docker:
	docker build -t needfire:$(VERSION) -t needfire:latest .

docker-run:
	docker run --rm -p $(PORT):8848 -v needfire-data:/data needfire:latest

image-pi:
	sudo bash os/image/raspberry-pi/build-image.sh

image-x86:
	sudo bash os/image/x86/build-iso.sh

image-docker:
	$(PY) scripts/build-image.py $(TARGET)

clean:
	rm -rf .needfire-home
