package diff

import "testing"

func TestCompare_AddedRemovedChanged(t *testing.T) {
	left := []byte(`{"a": 1, "b": 2, "c": 3}`)
	right := []byte(`{"a": 1, "b": 20, "d": 4}`)

	result, err := Compare(left, right)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Modified {
		t.Fatalf("expected Modified to be true")
	}
	if result.Stats.Added != 1 {
		t.Errorf("expected 1 added, got %d", result.Stats.Added)
	}
	if result.Stats.Removed != 1 {
		t.Errorf("expected 1 removed, got %d", result.Stats.Removed)
	}
	if result.Stats.Changed != 1 {
		t.Errorf("expected 1 changed, got %d", result.Stats.Changed)
	}
	if result.Stats.Unchanged != 1 {
		t.Errorf("expected 1 unchanged (key 'a'), got %d", result.Stats.Unchanged)
	}
}

func TestCompare_Identical(t *testing.T) {
	payload := []byte(`{"a": 1, "b": {"c": [1, 2, 3]}}`)

	result, err := Compare(payload, payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Modified {
		t.Fatalf("expected Modified to be false for identical payloads")
	}
	if result.Stats.Added != 0 || result.Stats.Removed != 0 || result.Stats.Changed != 0 {
		t.Errorf("expected zero stats, got %+v", result.Stats)
	}
}

func TestCompare_NestedObjects(t *testing.T) {
	left := []byte(`{"user": {"name": "Alice", "age": 30}}`)
	right := []byte(`{"user": {"name": "Alice", "age": 31}}`)

	result, err := Compare(left, right)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Stats.Changed != 1 {
		t.Errorf("expected 1 nested changed field, got %+v", result.Stats)
	}
}

func TestCompare_ArrayReordering(t *testing.T) {
	left := []byte(`{"items": [1, 2, 3]}`)
	right := []byte(`{"items": [3, 2, 1]}`)

	result, err := Compare(left, right)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Modified {
		t.Fatalf("expected array reordering to be detected as modified")
	}
}

func TestCompare_TypeChange(t *testing.T) {
	left := []byte(`{"value": "42"}`)
	right := []byte(`{"value": 42}`)

	result, err := Compare(left, right)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Stats.Changed != 1 {
		t.Errorf("expected type change to count as changed, got %+v", result.Stats)
	}
}

func TestCompare_MalformedLeftJSON(t *testing.T) {
	_, err := Compare([]byte(`{not valid json`), []byte(`{"a": 1}`))
	if err == nil {
		t.Fatal("expected error for malformed left JSON")
	}
	var parseErr *ParseError
	if !isParseError(err, &parseErr) {
		t.Fatalf("expected *ParseError, got %T: %v", err, err)
	}
	if parseErr.Side != "left" {
		t.Errorf("expected error side 'left', got %q", parseErr.Side)
	}
}

func TestCompare_MalformedRightJSON(t *testing.T) {
	_, err := Compare([]byte(`{"a": 1}`), []byte(`not json at all`))
	if err == nil {
		t.Fatal("expected error for malformed right JSON")
	}
	var parseErr *ParseError
	if !isParseError(err, &parseErr) {
		t.Fatalf("expected *ParseError, got %T: %v", err, err)
	}
	if parseErr.Side != "right" {
		t.Errorf("expected error side 'right', got %q", parseErr.Side)
	}
}

func TestAscii_ProducesOutput(t *testing.T) {
	left := []byte(`{"a": 1}`)
	right := []byte(`{"a": 2}`)

	out, err := Ascii(left, right)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out == "" {
		t.Fatal("expected non-empty ascii diff output")
	}
}

func isParseError(err error, target **ParseError) bool {
	pe, ok := err.(*ParseError)
	if ok {
		*target = pe
	}
	return ok
}
