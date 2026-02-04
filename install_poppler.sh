#!/bin/bash
# Install Poppler utilities (pdftoppm) on Ubuntu/Debian

sudo apt-get update
sudo apt-get install -y poppler-utils

# Verify installation
which pdftoppm
pdftoppm -v
