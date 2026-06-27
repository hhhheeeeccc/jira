GO ?= go
GOFLAGS ?=
GOPATH ?= $(shell go env GOPATH)
GOBIN ?= $(GOPATH)/bin
COMMIT ?= $(shell git rev-parse --short HEAD)
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION ?= $(shell grep '"version"' plugin.json | sed -E 's/.*"version": "([^"]+)".*/\1/')

GO_BUILD_FLAGS := -ldflags "-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildDate=$(BUILD_DATE)"

.PHONY: all dist server webapp clean test

# Default target
all: dist

# Build the full distribution tarball
dist: server webapp
	@echo "Creating dist/jira-plugin-$(VERSION).tar.gz..."
	@mkdir -p dist
	tar -czf dist/jira-plugin-$(VERSION).tar.gz \
		plugin.json \
		server/dist/ \
		webapp/dist/
	@echo "✅ dist/jira-plugin-$(VERSION).tar.gz created successfully!"

# Build the Go server
server:
	@echo "Building server..."
	@mkdir -p server/dist
	cd server && GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64
	cd server && GOOS=linux GOARCH=arm64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-arm64
	cd server && GOOS=darwin GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-darwin-amd64
	cd server && GOOS=darwin GOARCH=arm64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-darwin-arm64
	cd server && GOOS=windows GOARCH=amd64 $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-windows-amd64.exe
	@echo "✅ Server binaries built."

# Build the webapp
webapp:
	@echo "Building webapp..."
	cd webapp && npm install --legacy-peer-deps && npm run build
	@echo "✅ Webapp built."

# Build server for current platform only (fast dev build)
server-dev:
	@echo "Building server (current platform)..."
	@mkdir -p server/dist
	cd server && $(GO) build $(GOFLAGS) $(GO_BUILD_FLAGS) -o dist/plugin-linux-amd64
	@echo "✅ Server built."

# Build webapp in dev mode (watch)
webapp-dev:
	cd webapp && npm install --legacy-peer-deps && npm run start

# Clean build artifacts
clean:
	rm -rf server/dist/
	rm -rf webapp/dist/
	rm -rf webapp/node_modules/
	rm -rf dist/
	@echo "✅ Cleaned."

# Run tests
test:
	cd server && $(GO) test ./... -v

# Setup development environment
setup:
	@echo "Installing Go dependencies..."
	cd server && $(GO) mod download
	@echo "Installing Node.js dependencies..."
	cd webapp && npm install --legacy-peer-deps
	@echo "✅ Setup complete."

# Deploy to local Mattermost for development
deploy: server-dev webapp
	@echo "Deploying to Mattermost..."
	cp plugin.json $(MM_PLUGIN_PATH)/jira-plugin/
	cp -r server/dist/ $(MM_PLUGIN_PATH)/jira-plugin/server/dist/
	cp -r webapp/dist/ $(MM_PLUGIN_PATH)/jira-plugin/webapp/dist/
	@echo "✅ Deployed to $(MM_PLUGIN_PATH)/jira-plugin/"