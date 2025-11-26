#!/bin/bash
# Script de inicialização da API

cd "$(dirname "$0")"
NODE_ENV=production node src/index.js
