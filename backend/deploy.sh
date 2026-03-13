#!/bin/bash
set -e

echo "Cleaning up old build artifacts..."
rm -rf build_dist deployment_package.zip

echo "Creating build directory..."
mkdir build_dist

echo "Installing dependencies..."
pip -q install -r requirements.txt -t build_dist/

echo "Copying code..."
cp lambda_function.py  build_dist/
cp analyst_agent.py    build_dist/
cp explainer_agent.py  build_dist/
cp orchestrator.py     build_dist/
cp progress_narrator.py build_dist/
cp transcribe_handler.py build_dist/
cp fund_features.json  build_dist/

echo "Zipping package..."
cd build_dist
zip -rq ../deployment_package.zip . --exclude "*.pyc" --exclude "*/__pycache__/*"
cd ..

echo "Done. Package size: $(du -sh deployment_package.zip | cut -f1)"