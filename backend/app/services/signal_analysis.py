import numpy as np
import pandas as pd
from scipy import signal as scipy_signal
from scipy.stats import entropy
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, Tuple, List
import json


def compute_statistical_features(data: np.ndarray) -> Dict[str, float]:
    features = {}
    features["mean"] = float(np.mean(data))
    features["std"] = float(np.std(data))
    features["min"] = float(np.min(data))
    features["max"] = float(np.max(data))
    features["rms"] = float(np.sqrt(np.mean(data**2)))
    features["peak_to_peak"] = float(np.max(data) - np.min(data))

    if len(data) > 1:
        features["skewness"] = float(pd.Series(data).skew())
        features["kurtosis"] = float(pd.Series(data).kurtosis())

    return features


def compute_spectral_features(data: np.ndarray, fs: int) -> Dict[str, float]:
    features = {}
    freqs, psd = scipy_signal.welch(data, fs=fs, nperseg=min(256, len(data)))
    features["spectral_centroid"] = float(np.sum(freqs * psd) / np.sum(psd))
    features["spectral_bandwidth"] = float(np.sqrt(np.sum(((freqs - features["spectral_centroid"]) ** 2) * psd) / np.sum(psd)))
    features["spectral_entropy"] = float(entropy(psd + 1e-10))
    features["dominant_frequency"] = float(freqs[np.argmax(psd)])
    features["total_power"] = float(np.sum(psd))
    return features


def compute_time_domain_features(data: np.ndarray) -> Dict[str, float]:
    features = {}
    features["zero_crossing_rate"] = float(np.sum(np.diff(np.sign(data)) != 0) / len(data))
    features["mean_abs_change"] = float(np.mean(np.abs(np.diff(data))))
    return features


async def analyze_signal_data(
    data_path: str,
    method: str,
    parameters: Dict[str, Any],
) -> Tuple[Dict[str, Any], int]:
    data = load_signal_data(data_path)

    if method == "statistical":
        return statistical_analysis(data, parameters)
    elif method == "spectral":
        return spectral_analysis(data, parameters)
    elif method == "isolation_forest":
        return isolation_forest_analysis(data, parameters)
    elif method == "comprehensive":
        return comprehensive_analysis(data, parameters)
    else:
        raise ValueError(f"Unknown analysis method: {method}")


def load_signal_data(data_path: str) -> np.ndarray:
    if data_path.endswith(".csv"):
        df = pd.read_csv(data_path)
        if df.shape[1] == 1:
            return df.iloc[:, 0].values.astype(np.float32)
        return df.values.astype(np.float32)
    elif data_path.endswith(".json"):
        with open(data_path, "r") as f:
            data = json.load(f)
        return np.array(data, dtype=np.float32)
    elif data_path.endswith(".npy"):
        return np.load(data_path).astype(np.float32)
    else:
        raise ValueError(f"Unsupported file format: {data_path}")


def statistical_analysis(data: np.ndarray, params: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    features = compute_statistical_features(data)
    features.update(compute_time_domain_features(data))

    window_size = params.get("window_size", 100)
    anomalies = detect_statistical_anomalies(data, window_size, params.get("threshold", 3.0))

    return {
        "features": features,
        "anomaly_indices": anomalies.tolist(),
        "data_length": len(data),
    }, len(anomalies)


def detect_statistical_anomalies(data: np.ndarray, window_size: int, threshold: float) -> np.ndarray:
    if len(data) < window_size * 2:
        return np.array([], dtype=int)

    rolling_mean = pd.Series(data).rolling(window=window_size, center=True).mean()
    rolling_std = pd.Series(data).rolling(window=window_size, center=True).std()

    z_scores = np.abs((data - rolling_mean) / (rolling_std + 1e-10))
    anomalies = np.where(z_scores > threshold)[0]
    return anomalies


def spectral_analysis(data: np.ndarray, params: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    fs = params.get("sample_rate", 1000)
    features = compute_spectral_features(data, fs)

    window_size = params.get("window_size", 256)
    anomalies = detect_spectral_anomalies(data, fs, window_size, params.get("threshold", 2.0))

    return {
        "features": features,
        "anomaly_indices": anomalies.tolist(),
        "data_length": len(data),
    }, len(anomalies)


def detect_spectral_anomalies(data: np.ndarray, fs: int, window_size: int, threshold: float) -> np.ndarray:
    if len(data) < window_size * 2:
        return np.array([], dtype=int)

    anomalies = []
    step = window_size // 2
    baseline_entropy = None

    for i in range(0, len(data) - window_size, step):
        window = data[i:i + window_size]
        freqs, psd = scipy_signal.welch(window, fs=fs, nperseg=min(128, len(window)))
        spec_entropy = entropy(psd + 1e-10)

        if baseline_entropy is None:
            baseline_entropy = spec_entropy
        elif abs(spec_entropy - baseline_entropy) > threshold * baseline_entropy:
            anomalies.append(i + window_size // 2)

    return np.array(anomalies, dtype=int)


def isolation_forest_analysis(data: np.ndarray, params: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    contamination = params.get("contamination", 0.1)
    n_estimators = params.get("n_estimators", 100)
    window_size = params.get("window_size", 50)

    if len(data) < window_size * 2:
        return {"error": "Insufficient data for isolation forest"}, 0

    windows = []
    indices = []
    step = window_size // 2

    for i in range(0, len(data) - window_size, step):
        window = data[i:i + window_size]
        features = [
            np.mean(window),
            np.std(window),
            np.min(window),
            np.max(window),
            np.sqrt(np.mean(window**2)),
            np.sum(np.diff(np.sign(window)) != 0) / len(window),
        ]
        windows.append(features)
        indices.append(i + window_size // 2)

    if len(windows) < 10:
        return {"error": "Insufficient windows for isolation forest"}, 0

    X = np.array(windows)
    clf = IsolationForest(contamination=contamination, n_estimators=n_estimators, random_state=42)
    predictions = clf.fit_predict(X)
    anomaly_scores = clf.decision_function(X)

    anomaly_indices = [indices[i] for i, p in enumerate(predictions) if p == -1]

    return {
        "anomaly_indices": anomaly_indices,
        "anomaly_scores": anomaly_scores.tolist(),
        "window_indices": indices,
        "data_length": len(data),
        "n_windows": len(windows),
    }, len(anomaly_indices)


def comprehensive_analysis(data: np.ndarray, params: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    fs = params.get("sample_rate", 1000)

    stat_features = compute_statistical_features(data)
    stat_features.update(compute_time_domain_features(data))

    spec_features = compute_spectral_features(data, fs)

    iso_results, iso_count = isolation_forest_analysis(data, params)
    stat_results, stat_count = statistical_analysis(data, params)
    spec_results, spec_count = spectral_analysis(data, params)

    all_anomalies = set()
    if "anomaly_indices" in iso_results:
        all_anomalies.update(iso_results["anomaly_indices"])
    if "anomaly_indices" in stat_results:
        all_anomalies.update(stat_results["anomaly_indices"])
    if "anomaly_indices" in spec_results:
        all_anomalies.update(spec_results["anomaly_indices"])

    return {
        "statistical_features": stat_features,
        "spectral_features": spec_features,
        "isolation_forest": iso_results,
        "statistical_anomalies": stat_results.get("anomaly_indices", []),
        "spectral_anomalies": spec_results.get("anomaly_indices", []),
        "combined_anomaly_indices": sorted(list(all_anomalies)),
        "data_length": len(data),
    }, len(all_anomalies)