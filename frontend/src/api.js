const API_BASE = "http://127.0.0.1:8000/api";

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchRepositories() {
  const res = await fetch(`${API_BASE}/repos`);
  if (!res.ok) throw new Error("Failed to fetch repositories");
  return res.json();
}

export async function addRepository(repoUrlOrName, description = "") {
  const res = await fetch(`${API_BASE}/repos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url_or_name: repoUrlOrName, description })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to add repository");
  }
  return res.json();
}

export async function deleteRepository(repoId) {
  const res = await fetch(`${API_BASE}/repos/${repoId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete repository");
  return res.json();
}

export async function triggerRepoScan(repoId) {
  const res = await fetch(`${API_BASE}/repos/${repoId}/scan`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Scan failed");
  return res.json();
}

export async function triggerScanAll() {
  const res = await fetch(`${API_BASE}/repos/scan-all`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Global scan failed");
  return res.json();
}

export async function fetchFindings(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== "all") searchParams.append("status", params.status);
  if (params.severity && params.severity !== "all") searchParams.append("severity", params.severity);
  if (params.secret_type && params.secret_type !== "all") searchParams.append("secret_type", params.secret_type);
  if (params.search) searchParams.append("search", params.search);

  const res = await fetch(`${API_BASE}/findings?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch findings");
  return res.json();
}

export async function updateFindingStatus(findingId, status) {
  const res = await fetch(`${API_BASE}/findings/${findingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

export async function simulateSyntheticPush(repoName, secretType, secretVal) {
  // Simulates a GitHub push webhook event
  const commitId = Math.random().toString(36).substring(2, 9);
  const payload = {
    repository: {
      full_name: repoName,
      name: repoName.split("/")[1] || repoName,
      owner: { login: repoName.split("/")[0] || "student" },
      description: "Synthetic test push"
    },
    commits: [
      {
        id: commitId,
        message: `test: add ${secretType} synthetic commit`,
        url: `https://github.com/${repoName}/commit/${commitId}`
      }
    ]
  };

  const res = await fetch(`${API_BASE}/webhook/github`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push"
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}
