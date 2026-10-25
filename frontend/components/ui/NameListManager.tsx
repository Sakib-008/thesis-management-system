"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/apiClient";
import { NamedRef } from "@/lib/types";

// One reusable screen for any "list of names" resource (departments, research fields).
export default function NameListManager({ title, endpoint, deleteWarning }: {
  title: string;
  endpoint: string;
  deleteWarning: string;
}) {
  const [items, setItems] = useState<NamedRef[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<NamedRef[]>(endpoint));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    run(async () => { await apiPost(endpoint, { name }); setName(""); });
  }

  function rename(item: NamedRef) {
    const next = window.prompt("New name", item.name);
    if (!next || next.trim() === item.name) return;
    run(() => apiPatch(`${endpoint}/${item.id}`, { name: next.trim() }));
  }

  function remove(item: NamedRef) {
    if (!window.confirm(`Delete "${item.name}"? ${deleteWarning}`)) return;
    run(() => apiDelete(`${endpoint}/${item.id}`));
  }

  return (
    <>
      <h1>{title}</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form className="row" onSubmit={add}>
          <label>New name
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={150} />
          </label>
          <button className="btn">Add</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => rename(item)}>Rename</button>{" "}
                  <button className="btn btn-small" onClick={() => remove(item)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={2} className="muted">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}