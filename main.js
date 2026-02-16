async function runSearch() {
  const query = document.getElementById("queryInput").value.trim();
  const output = document.getElementById("output");

  if (!query) {
    output.textContent = "Enter a search query.";
    return;
  }

  output.textContent = "Searching…";

  try {
    // ⚠️ TEMP placeholder — will point to your Arnold Worker
    const res = await fetch("https://REPLACE-WITH-ARNOLD-WORKER/admin/nl-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = "Error: " + err.message;
  }
}
