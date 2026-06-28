GO ?= go
GOFLAGS ?=
GOPATH ?= $(shell $(GO) env GOPATH 2>/dev/null)
GOBIN ?= $(GOPATH)/bin
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION ?= $(shell grep '"version"' plugin.json | sed -E 's/.*"version": "([^"]+)".*/\1/')

export GOTOOLCHAIN := local
export CGO_ENABLED := 1

GO_BUILD_FLAGS := -ldflags "-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildDate=$(BUILD_DATE)"

.PHONY: all dist server webapp clean test setup deploy

all: dist

dist: server webapp
	@echo "Creating dist/jira-plugin-$(VERSION).tar.gz..."
	@mkdir -p dist
	tar -czf dist/jira-plugin-$(VERSION).tar.gz \
		plugin.json \
		server/dist/ \
		webapp/dist/
	@echo "dist/jira-plugin-$(VERSION).tar.gz created successfully!"

server: server-linux-amd64 server-linux-arm64 server-darwin-amd64 server-darwin-arm64 server-windows-amd64
	@echo "Server binaries built."

server-linux-amd64:
	@mkdir -p server/dist
	@echo "  -> linux/amd64"
	@cd server && GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64 || (echo "  -> linux/amd64 failed" && true)

server-linux-arm64:
	@mkdir -p server/dist
	@echo "  -> linux/arm64"
	@cd server && GOOS=linux GOARCH=arm64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-arm64 || (echo "  -> linux/arm64 skipped" && true)

server-darwin-amd64:
	@mkdir -p server/dist
	@echo "  -> darwin/amd64"
	@cd server && GOOS=darwin GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-darwin-amd64 || (echo "  -> darwin/amd64 skipped" && true)

server-darwin-arm64:
	@mkdir -p server/dist
	@echo "  -> darwin/arm64"
	@cd server && GOOS=darwin GOARCH=arm64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-darwin-arm64 || (echo "  -> darwin/arm64 skipped" && true)

server-windows-amd64:
	@mkdir -p server/dist
	@echo "  -> windows/amd64"
	@cd server && GOOS=windows GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-windows-amd64.exe || (echo "  -> windows/amd64 skipped" && true)

webapp:
	@echo "Building webapp..."
	cd webapp && npm install --legacy-peer-deps && npm run build
	@echo "Webapp built."

server-dev:
	@echo "Building server (current platform)..."
	@mkdir -p server/dist
	cd server && $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64
	@echo "Server built."

webapp-dev:
	cd webapp && npm install --legacy-peer-deps && npm run dev

clean:
	rm -rf server/dist/
	rm -rf webapp/dist/
	rm -rf webapp/node_modules/
	rm -rf dist/
	@echo "Cleaned."

test:
	cd server && $(GO) test ./... -v

setup:
	@echo "Installing Go dependencies..."
	cd server && $(GO) mod download
	@echo "Installing Node.js dependencies..."
	cd webapp && npm install --legacy-peer-deps
	@echo "Setup complete."

deploy: server-dev webapp
	@echo "Deploying to Mattermost..."
	mkdir -p $(MM_PLUGIN_PATH)/jira-plugin/
	cp plugin.json $(MM_PLUGIN_PATH)/jira-plugin/
	cp -r server/dist/ $(MM_PLUGIN_PATH)/jira-plugin/server/dist/
	cp -r webapp/dist/ $(MM_PLUGIN_PATH)/jira-plugin/webapp/dist/
	@echo "Deployed to $(MM_PLUGIN_PATH)/jira-plugin/"
