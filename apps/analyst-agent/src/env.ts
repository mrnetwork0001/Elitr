// Treat empty entries in .env ("FOO=") as unset so code defaults apply.
for (const [k, v] of Object.entries(process.env)) if (v?.trim() === "") delete process.env[k];
