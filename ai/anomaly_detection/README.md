# Umbrella damage detection experiments

Python scripts for collecting/cropping umbrella images, training a PatchCore model,
exporting ONNX and running local inference. `train.py`, `infer.py`, `crop.py` and
`decision.py` contain the main pipeline; inspect each script's CLI options and defaults.

Datasets, photographs, trained weights, metadata and deployment bundles are omitted.
Supply a dataset that you are authorized to use, configure its paths, train/export your
own model and place the artifacts in a local ignored `weights/` directory. Some scripts
assume the original directory layout or thresholds; adjust them to your data/model.
Prior evaluation metrics cannot be reproduced from this source-only export.

Use an isolated Python environment. Install torch/torchvision appropriate for your
hardware, then `pip install -r requirements.txt`. Webcam tools require GUI-enabled OpenCV.
Anomalib may install headless OpenCV, so check GUI compatibility for your environment.
For Jetson, separately validate ONNX runtime, CUDA/JetPack and model compatibility.

Camera captures can contain people and identifying information. Use consented inputs,
minimize the view, define retention/deletion and keep captures out of Git. Do not add
unreviewed photos, models or bundled dependency binaries to this repository.
