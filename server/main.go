package main

import (
	"github.com/mattermost/mattermost-server/v6/plugin"
)

var (
	version   = "development"
	commit    = "none"
	buildDate = "unknown"
)

func main() {
	p := NewPlugin()
	p.SetVersion(version)
	p.SetBuildDate(buildDate)
	p.SetCommit(commit)

	plugin.ClientMain(p)
}