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
- Improve URL prioritization across subdomains.
- Improve source evidence collection and merging.
- Add clearer runtime status output.
- Improve handling of failed pages.

### Reporting
- Improve Markdown report readability.
- Add summary sections for detected vendors.
- Add clearer confidence/evidence explanations.

### Testing
- Expand Playwright fixture coverage.
- Add unit tests for URL prioritization.
- Add unit tests for evidence merging.
- Add regression tests for known detection patterns.

### Team Usability
- Add clearer CLI help text.
- Add example scan outputs.
- Add troubleshooting guidance.
- Add configuration options.

## Deferred / Not Yet Planned

- CI/CD pipeline
- npm package publishing
- GUI/dashboard
- Scheduled scans