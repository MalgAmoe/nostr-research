import { createSignal } from "solid-js";

export function createResearchLibrary({ workspaceId, workspaces = [], decisions = [] }) {
  const [recipes, setRecipes] = createSignal([]);
  const [activeRecipeId, setActiveRecipeId] = createSignal("");
  const [collections, setCollections] = createSignal([]);
  const [collectionDraft, setCollectionDraft] = createSignal("");
  const [lastRunDelta, setLastRunDelta] = createSignal(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = createSignal(workspaceId);
  const [workspaceList, setWorkspaceList] = createSignal(workspaces);
  const [researchDecisions, setResearchDecisions] = createSignal(decisions);

  const recordDecision = (type, label, detail = "") => setResearchDecisions((current) => [
    ...current,
    { id: crypto.randomUUID(), at: Date.now(), type, label, detail },
  ].slice(-30));

  return {
    recipes, setRecipes, activeRecipeId, setActiveRecipeId, collections, setCollections,
    collectionDraft, setCollectionDraft, lastRunDelta, setLastRunDelta,
    activeWorkspaceId, setActiveWorkspaceId, workspaces: workspaceList, setWorkspaces: setWorkspaceList,
    researchDecisions, setResearchDecisions, recordDecision,
  };
}
