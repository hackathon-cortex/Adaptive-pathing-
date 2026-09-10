"""
Standalone Diagnostic Script: CARLA Perception & LiDAR Point Cloud Validation

This script is a standalone diagnostic tool designed to validate two components independently:
1. Camera Object Detection Pipeline: Uses existing IntegratedPipeline (YOLO + ByteTrack + Risk/Prediction).
2. LiDAR Point Cloud Processing: Reads PCD file, performs RANSAC ground-plane segmentation,
   and clusters obstacles using DBSCAN with Open3D.

Note:
- This script does NOT modify or rebuild anything in core/prediction/ or core/perception/.
- Ground-truth comparison against CARLA YAML files is intentionally out of scope for this diagnostic.
"""

import argparse
import colorsys
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

# Ensure SIH root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def run_camera_detection(
    image_paths: List[Path],
    model_path: str = "best.pt",
    conf_threshold: float = 0.25,
) -> Tuple[str, str]:
    """
    Run YOLO perception & prediction test using existing IntegratedPipeline.

    Returns:
        status: "PASS", "FAIL", or "SKIPPED"
        summary_msg: Human-readable diagnostic message
    """
    print("\n" + "=" * 60)
    print("PART 1: CAMERA / OBJECT DETECTION TEST")
    print("=" * 60)

    if not image_paths:
        print("[INFO] No camera image provided. Skipping camera test.")
        return "SKIPPED", "No image specified"

    # Lazy import to keep diagnostic clean if perception dependencies fail
    try:
        from core.integrated_pipeline import IntegratedPipeline
    except Exception as e:
        err_msg = f"Failed to import IntegratedPipeline: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    # Verify model file exists
    model_file = Path(model_path)
    if not model_file.exists():
        # Check if relative to PROJECT_ROOT
        if (PROJECT_ROOT / model_path).exists():
            model_file = PROJECT_ROOT / model_path
        else:
            err_msg = f"YOLO model file not found at: {model_path}"
            print(f"[FAIL] {err_msg}")
            return "FAIL", err_msg

    try:
        print(f"[INIT] Loading IntegratedPipeline with model: {model_file.resolve()} (conf={conf_threshold})")
        pipeline = IntegratedPipeline(
            model_path=str(model_file),
            conf_threshold=conf_threshold,
        )
    except Exception as e:
        err_msg = f"Pipeline initialization failed: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    all_passed = True
    total_valid_detections = 0
    max_confidence = 0.0
    reasons = []

    for img_path in image_paths:
        print(f"\n--- Testing Image: {img_path} ---")
        if not img_path.exists():
            msg = f"Image file does not exist: {img_path}"
            print(f"[FAIL] {msg}")
            reasons.append(msg)
            all_passed = False
            continue

        frame = cv2.imread(str(img_path))
        if frame is None or frame.size == 0:
            msg = f"cv2.imread failed to load image: {img_path}"
            print(f"[FAIL] {msg}")
            reasons.append(msg)
            all_passed = False
            continue

        h, w, c = frame.shape
        print(f"[LOAD] Image loaded successfully: {w}x{h}, {c} channels")

        try:
            output_payload, annotated_frame = pipeline.process_frame(frame)
        except Exception as e:
            msg = f"process_frame() raised an exception on {img_path.name}: {e}"
            print(f"[FAIL] {msg}")
            reasons.append(msg)
            all_passed = False
            continue

        # Print full JSON prediction payload
        print("\nFull JSON Prediction Payload:")
        print(json.dumps(output_payload, indent=2))

        # Save annotated image next to original
        annotated_out = img_path.parent / f"{img_path.stem}_annotated.jpg"
        save_success = cv2.imwrite(str(annotated_out), annotated_frame)
        if save_success:
            print(f"[SAVED] Annotated image saved to: {annotated_out.resolve()}")
        else:
            print(f"[WARNING] Failed to write annotated image to: {annotated_out}")

        predictions = output_payload.get("predictions", [])
        valid_dets = [p for p in predictions if p.get("confidence", 0.0) >= conf_threshold]

        if valid_dets:
            for p in valid_dets:
                conf = float(p.get("confidence", 0.0))
                if conf > max_confidence:
                    max_confidence = conf
            total_valid_detections += len(valid_dets)
            print(f"[PASS] {len(valid_dets)} object(s) detected with conf >= {conf_threshold}")
        else:
            all_passed = False
            msg = f"{img_path.name}: 0 objects detected with confidence >= {conf_threshold}"
            print(f"[FAIL] {msg}")
            reasons.append(msg)

    if all_passed and total_valid_detections > 0:
        det_word = "object" if total_valid_detections == 1 else "objects"
        summary = f"{total_valid_detections} {det_word} detected, conf={max_confidence:.2f}"
        return "PASS", summary
    elif total_valid_detections > 0:
        summary = f"Partial: {total_valid_detections} detected, but issues encountered ({'; '.join(reasons)})"
        return "FAIL", summary
    else:
        summary = "; ".join(reasons) if reasons else f"0 objects detected with confidence >= {conf_threshold}"
        return "FAIL", summary


def run_lidar_processing(
    pcd_path: Optional[Path],
    distance_threshold: float = 0.2,
    ransac_n: int = 3,
    num_iterations: int = 1000,
    dbscan_eps: float = 0.5,
    dbscan_min_points: int = 10,
) -> Tuple[str, str]:
    """
    Run LiDAR point cloud ground segmentation and DBSCAN obstacle clustering.

    Returns:
        status: "PASS", "FAIL", or "SKIPPED"
        summary_msg: Human-readable diagnostic message
    """
    print("\n" + "=" * 60)
    print("PART 2: LIDAR POINT CLOUD TEST")
    print("=" * 60)

    if pcd_path is None:
        print("[INFO] No PCD file provided. Skipping LiDAR test.")
        return "SKIPPED", "No PCD file specified"

    if not pcd_path.exists():
        err_msg = f"PCD file not found at: {pcd_path}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    # Step 1: Open3D import
    try:
        import open3d as o3d
    except ImportError:
        err_msg = "open3d is not installed in the active environment. Run: pip install open3d"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg
    except Exception as e:
        err_msg = f"Failed to import open3d: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    print(f"[INIT] Open3D version: {o3d.__version__}")
    print(f"[LOAD] Reading point cloud: {pcd_path.resolve()}")

    # Load point cloud
    try:
        pcd = o3d.io.read_point_cloud(str(pcd_path))
    except Exception as e:
        err_msg = f"open3d.io.read_point_cloud() raised an exception: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    pts = np.asarray(pcd.points)
    total_points = len(pts)
    if total_points == 0:
        err_msg = f"Point cloud is empty (0 points found in {pcd_path.name})"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    # Step 2: Basic Stats & Bounding Box
    min_bound = pts.min(axis=0)
    max_bound = pts.max(axis=0)
    span = max_bound - min_bound

    print(f"\n[STATS] Total Point Count: {total_points:,}")
    print("[STATS] Bounding Box Range (min/max per axis):")
    print(f"        X: [{min_bound[0]:10.3f} m  ->  {max_bound[0]:10.3f} m]  (span: {span[0]:.3f} m)")
    print(f"        Y: [{min_bound[1]:10.3f} m  ->  {max_bound[1]:10.3f} m]  (span: {span[1]:.3f} m)")
    print(f"        Z: [{min_bound[2]:10.3f} m  ->  {max_bound[2]:10.3f} m]  (span: {span[2]:.3f} m)")

    # Step 3: Ground-plane segmentation via RANSAC
    print("\n[GROUND] Segmenting ground plane using RANSAC...")
    print(f"         distance_threshold={distance_threshold}, ransac_n={ransac_n}, num_iterations={num_iterations}")
    try:
        plane_model, inliers = pcd.segment_plane(
            distance_threshold=distance_threshold,
            ransac_n=ransac_n,
            num_iterations=num_iterations,
        )
    except Exception as e:
        err_msg = f"segment_plane() failed with error: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    if len(inliers) == 0:
        err_msg = "No ground plane found by RANSAC"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    a, b, c, d = plane_model
    ground_pts_count = len(inliers)
    non_ground_pts_count = total_points - ground_pts_count
    ground_pct = (ground_pts_count / total_points) * 100
    non_ground_pct = (non_ground_pts_count / total_points) * 100

    print(f"[GROUND] Fitted Plane Equation: {a:.5f}x + {b:.5f}y + {c:.5f}z + {d:.5f} = 0")
    print(f"[GROUND] Ground points:     {ground_pts_count:,} ({ground_pct:.1f}%)")
    print(f"[GROUND] Non-ground points: {non_ground_pts_count:,} ({non_ground_pct:.1f}%)")

    ground_cloud = pcd.select_by_index(inliers)
    non_ground_cloud = pcd.select_by_index(inliers, invert=True)

    # Step 4: Clustering non-ground points using DBSCAN
    print("\n[CLUSTER] Clustering non-ground points using DBSCAN...")
    print(f"          eps={dbscan_eps}, min_points={dbscan_min_points}")
    try:
        labels = np.array(
            non_ground_cloud.cluster_dbscan(
                eps=dbscan_eps,
                min_points=dbscan_min_points,
                print_progress=False,
            )
        )
    except Exception as e:
        err_msg = f"cluster_dbscan() failed with error: {e}"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    max_label = labels.max() if len(labels) > 0 else -1
    num_clusters = int(max_label + 1)
    noise_count = int(np.sum(labels == -1))

    print(f"[CLUSTER] Found {num_clusters} candidate object clusters (Noise points: {noise_count:,})")

    non_ground_pts = np.asarray(non_ground_cloud.points)
    for c_id in range(num_clusters):
        c_mask = labels == c_id
        c_points = non_ground_pts[c_mask]
        c_count = len(c_points)
        c_centroid = c_points.mean(axis=0)
        c_min = c_points.min(axis=0)
        c_max = c_points.max(axis=0)
        c_extent = c_max - c_min
        print(
            f"  Cluster #{c_id + 1:2d}: {c_count:5d} pts | "
            f"Centroid: (X={c_centroid[0]:7.2f}, Y={c_centroid[1]:7.2f}, Z={c_centroid[2]:7.2f}) m | "
            f"Extent: [dx={c_extent[0]:.2f}, dy={c_extent[1]:.2f}, dz={c_extent[2]:.2f}] m"
        )

    if num_clusters == 0:
        err_msg = "Zero clusters detected after ground removal"
        print(f"[FAIL] {err_msg}")
        return "FAIL", err_msg

    # Step 5: Save visualization PLY
    print("\n[VISUALIZATION] Generating colored PLY point cloud...")
    # Color ground points gray
    ground_cloud.paint_uniform_color([0.55, 0.55, 0.55])

    # Assign distinct colors to each cluster using golden ratio hue distribution
    non_ground_colors = np.zeros((len(labels), 3), dtype=np.float64)
    # Dark charcoal for noise points
    non_ground_colors[labels == -1] = [0.15, 0.15, 0.15]

    for c_id in range(num_clusters):
        # Distribute hues evenly for high visual distinction
        hue = (c_id * 0.618033988749895) % 1.0
        rgb = colorsys.hsv_to_rgb(hue, 0.85, 0.95)
        non_ground_colors[labels == c_id] = rgb

    non_ground_cloud.colors = o3d.utility.Vector3dVector(non_ground_colors)

    # Combine ground and non-ground clouds
    combined_cloud = ground_cloud + non_ground_cloud

    out_ply = pcd_path.parent / f"{pcd_path.stem}_clustered.ply"
    try:
        o3d.io.write_point_cloud(str(out_ply), combined_cloud)
        print(f"[SAVED] Clustered point cloud saved to: {out_ply.resolve()}")
    except Exception as e:
        print(f"[WARNING] Could not write PLY file: {e}")

    summary = f"{total_points} points, 1 ground plane, {num_clusters} clusters"
    print(f"[PASS] LiDAR processing succeeded: {summary}")
    return "PASS", summary


def main():
    parser = argparse.ArgumentParser(
        description="Standalone CARLA perception & LiDAR diagnostic test."
    )
    parser.add_argument(
        "--image",
        dest="images",
        nargs="+",
        default=None,
        help="Path(s) to one or more camera images (e.g. 003507_camera1.png)",
    )
    parser.add_argument(
        "--pcd",
        type=str,
        default=None,
        help="Path to PCD point cloud file (e.g. 003507.pcd)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="best.pt",
        help="Path to YOLO model weights (default: best.pt)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold for camera detection (default: 0.25)",
    )
    parser.add_argument(
        "--dist-thresh",
        type=float,
        default=0.2,
        help="RANSAC distance threshold for ground plane (default: 0.2)",
    )
    parser.add_argument(
        "--eps",
        type=float,
        default=0.5,
        help="DBSCAN clustering epsilon (default: 0.5)",
    )
    parser.add_argument(
        "--min-points",
        type=int,
        default=10,
        help="DBSCAN clustering minimum points (default: 10)",
    )

    args = parser.parse_args()

    # Convert paths
    image_paths = [Path(p) for p in args.images] if args.images else []
    pcd_path = Path(args.pcd) if args.pcd else None

    if not image_paths and pcd_path is None:
        print("[NOTICE] Neither --image nor --pcd was specified.")
        print("Defaulting to local test files if present in workspace:")
        default_img = PROJECT_ROOT / "003507_camera1.png"
        default_pcd = PROJECT_ROOT / "003507.pcd"
        if default_img.exists():
            print(f"  Found default image: {default_img.name}")
            image_paths = [default_img]
        if default_pcd.exists():
            print(f"  Found default PCD:   {default_pcd.name}")
            pcd_path = default_pcd

    # Execute Part 1: Camera Detection
    camera_status, camera_summary = run_camera_detection(
        image_paths=image_paths,
        model_path=args.model,
        conf_threshold=args.conf,
    )

    # Execute Part 2: LiDAR Point Cloud Processing
    lidar_status, lidar_summary = run_lidar_processing(
        pcd_path=pcd_path,
        distance_threshold=args.dist_thresh,
        ransac_n=3,
        num_iterations=1000,
        dbscan_eps=args.eps,
        dbscan_min_points=args.min_points,
    )

    # Final Summary Block
    print("\n" + "=" * 50)
    print("DIAGNOSTIC TEST SUMMARY")
    print("=" * 50)
    print(f"Camera detection:  {camera_status} ({camera_summary})")
    print(f"LiDAR processing:  {lidar_status} ({lidar_summary})")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
