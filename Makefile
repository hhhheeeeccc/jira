GO ?= $(HOME)/go-sdk/go/bin/go
GOFLAGS ?=
GOPATH ?= $(shell $(GO) env GOPATH 2>/dev/null)
GOBIN ?= $(GOPATH)/bin
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION ?= $(shell grep '"version"' plugin.json | sed -E 's/.*"version": "([^"]+)".*/\1/')

export GOTOOLCHAIN := local
export CGO_ENABLED := 1
export CGO_CFLAGS := -Wno-return-local-addr

GO_BUILD_FLAGS := -ldflags "-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildDate=$(BUILD_DATE)"

.PHONY: all dist server webapp clean test setup

all: dist

dist: server webapp
        @echo "==> Creating dist/jira-plugin-$(VERSION).tar.gz..."
        @mkdir -p dist
        tar -czf dist/jira-plugin-$(VERSION).tar.gz \
                plugin.json \
                server/dist/plugin-linux-amd64 \
                webapp/dist/main.js
        @echo "==> dist/jira-plugin-$(VERSION).tar.gz created successfully!"
        @ls -lh dist/jira-plugin-$(VERSION).tar.gz

server:
        @echo "==> Building server (linux/amd64)..."
        @mkdir -p server/dist
        cd server && GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64
        @echo "==> Server binary built."

webapp:
        @echo "==> Building webapp..."
        cd webapp && npm install --legacy-peer-deps && npm run build
        @echo "==> Webapp built."

server-dev:
        @echo "==> Building server (dev, current platform)..."
        @mkdir -p server/dist
        cd server && $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64
        @echo "==> Server built (dev)."

webapp-dev:
        cd webapp && npm install --legacy-peer-deps && npm run dev

clean:
        rm -rf server/dist/
        rm -rf webapp/dist/
        rm -rf webapp/node_modules/
        rm -rf dist/
        @echo "==> Cleaned."

test:
        cd server && $(GO) test ./... -v

setup:
        @echo "==> Installing Go dependencies..."
        cd server && $(GO) mod download
        @echo "==> Installing Node.js dependencies..."
        cd webapp && npm install --legacy-peer-deps
        @echo "==> Setup complete."