# Backlog

This file tracks possible future improvements that are not currently committed to a release.

## Candidate Improvements

### CLI Runtime Feedback
The scanner runtime feedback should show:

- Start time
- Target URL
- Current page being scanned
- Number of URLs discovered
- Number of URLs queued
- Number of URLs scanned
- Number of detections found
- Retry/failure messages
- Output file location
- Completion status

### Scanner Behavior
- Add clearer runtime status output.
- Improve handling of failed pages.

### Reporting
- Add summary sections for detected vendors.
- Add clearer confidence/evidence explanations.
- Track explicit skip reasons for discovered URLs that are not selected.

### Testing
- Expand Playwright fixture coverage.
- Add regression tests for known detection patterns.

### Team Usability
- Add example scan outputs.
- Add configuration options.

## Deferred / Not Yet Planned

- CI/CD pipeline
- npm package publishing
- GUI/dashboard
- Scheduled scans
