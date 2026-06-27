package main

import (
    "fmt"
    "os"

    "github.com/mattermost/mattermost/server/v8/public/plugin"
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

    if err := plugin.Main(p); err != nil {
        fmt.Fprintf(os.Stderr, "failed to start plugin: %v\n", err)
        os.Exit(1)
    }
}
