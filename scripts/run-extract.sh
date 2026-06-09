#!/bin/bash
eval "$(base64 -w0 < scripts/fc26-extractor.js | xargs -0 agent-browser eval -b)"
