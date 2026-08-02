// Package diff computes structured diffs between two JSON object payloads,
// wrapping gojsondiff and exposing results in the jsondiffpatch delta shape
// (so a future frontend can reuse jsondiffpatch.js to render highlights).
package diff

import (
	"encoding/json"
	"fmt"

	gojsondiff "github.com/yudai/gojsondiff"
	"github.com/yudai/gojsondiff/formatter"
)

// Result is the outcome of comparing two JSON payloads.
type Result struct {
	Delta    map[string]interface{} `json:"delta"`
	Stats    Stats                  `json:"stats"`
	Modified bool                   `json:"modified"`
}

// Stats summarizes a diff for a quick-glance view.
type Stats struct {
	Added     int `json:"added"`
	Removed   int `json:"removed"`
	Changed   int `json:"changed"`
	Moved     int `json:"moved"`
	Unchanged int `json:"unchanged"`
}

// ParseError reports which side of the comparison failed to parse as JSON.
type ParseError struct {
	Side string // "left" or "right"
	Err  error
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("invalid JSON on %s side: %v", e.Side, e.Err)
}

func (e *ParseError) Unwrap() error { return e.Err }

// Compare parses left and right as JSON objects and returns a structured diff.
func Compare(left, right []byte) (*Result, error) {
	var leftMap, rightMap map[string]interface{}
	if err := json.Unmarshal(left, &leftMap); err != nil {
		return nil, &ParseError{Side: "left", Err: err}
	}
	if err := json.Unmarshal(right, &rightMap); err != nil {
		return nil, &ParseError{Side: "right", Err: err}
	}

	differ := gojsondiff.New()
	d := differ.CompareObjects(leftMap, rightMap)

	deltaJSON, err := formatter.NewDeltaFormatter().FormatAsJson(d)
	if err != nil {
		return nil, fmt.Errorf("formatting delta: %w", err)
	}
	if deltaJSON == nil {
		deltaJSON = map[string]interface{}{}
	}

	stats := countDeltas(d.Deltas())
	stats.Unchanged = countUnchangedTopLevel(leftMap, rightMap, d.Deltas())

	return &Result{
		Delta:    deltaJSON,
		Stats:    stats,
		Modified: d.Modified(),
	}, nil
}

// Ascii renders a human-readable, indented text diff (used for text export).
func Ascii(left, right []byte) (string, error) {
	var leftMap, rightMap map[string]interface{}
	if err := json.Unmarshal(left, &leftMap); err != nil {
		return "", &ParseError{Side: "left", Err: err}
	}
	if err := json.Unmarshal(right, &rightMap); err != nil {
		return "", &ParseError{Side: "right", Err: err}
	}

	d := gojsondiff.New().CompareObjects(leftMap, rightMap)
	f := formatter.NewAsciiFormatter(leftMap, formatter.AsciiFormatterDefaultConfig)
	return f.Format(d)
}

// countDeltas walks the delta tree recursively (Object/Array deltas nest
// further deltas) and tallies how many leaf changes of each kind occurred.
func countDeltas(deltas []gojsondiff.Delta) Stats {
	var s Stats
	for _, delta := range deltas {
		switch v := delta.(type) {
		case *gojsondiff.Object:
			s = mergeStats(s, countDeltas(v.Deltas))
		case *gojsondiff.Array:
			s = mergeStats(s, countDeltas(v.Deltas))
		case *gojsondiff.Added:
			s.Added++
		case *gojsondiff.Deleted:
			s.Removed++
		case *gojsondiff.TextDiff:
			s.Changed++
		case *gojsondiff.Modified:
			s.Changed++
		case *gojsondiff.Moved:
			s.Moved++
		}
	}
	return s
}

func mergeStats(a, b Stats) Stats {
	return Stats{
		Added:   a.Added + b.Added,
		Removed: a.Removed + b.Removed,
		Changed: a.Changed + b.Changed,
		Moved:   a.Moved + b.Moved,
	}
}

// countUnchangedTopLevel counts keys present in either payload that no
// top-level delta touched, giving a cheap "how much stayed the same" signal.
func countUnchangedTopLevel(left, right map[string]interface{}, deltas []gojsondiff.Delta) int {
	touched := make(map[string]bool, len(deltas))
	for _, d := range deltas {
		switch v := d.(type) {
		case *gojsondiff.Deleted:
			touched[v.PrePosition().String()] = true
		case gojsondiff.PostDelta:
			touched[v.PostPosition().String()] = true
		}
	}

	all := make(map[string]bool, len(left)+len(right))
	for k := range left {
		all[k] = true
	}
	for k := range right {
		all[k] = true
	}

	unchanged := 0
	for k := range all {
		if !touched[k] {
			unchanged++
		}
	}
	return unchanged
}
