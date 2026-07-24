import { Show } from "solid-js";

const ACTIONS = [
  ["onFilter", "filter current"],
  ["onSearch", "search wider"],
  ["onDirection", "add to direction"],
  ["onOpen", "open details"],
  ["onCompare", "compare"],
  ["onExclude", "exclude"],
];

export function EntityActions(props) {
  const available = () => ACTIONS.filter(([handler]) => typeof props[handler] === "function");
  return <Show when={available().length}>
    <details class="relative shrink-0">
      <summary title={`Research actions for ${props.label ?? "entity"}`} class="cursor-pointer list-none rounded border border-emerald-950 px-1.5 py-1 font-mono text-[9px] text-emerald-700 hover:border-cyan-800 hover:text-cyan-300">actions</summary>
      <div class="absolute right-0 top-7 z-40 w-40 rounded border border-emerald-800 bg-[#07110c] p-1 shadow-2xl">
        {available().map(([handler, label]) => <button type="button" onClick={() => props[handler]()} class={`block w-full rounded px-2 py-1.5 text-left font-mono text-[9px] hover:bg-emerald-950 ${handler === "onExclude" ? "text-amber-600 hover:text-amber-300" : "text-emerald-500 hover:text-lime-300"}`}>{props[`${handler}Label`] ?? label}</button>)}
      </div>
    </details>
  </Show>;
}
