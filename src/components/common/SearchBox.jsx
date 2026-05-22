import { useMemo, useState } from "react";
import Surface from "./Surface.jsx";
import { displayMeta, displayName } from "../../utils/person.js";

export default function SearchBox({ people, selectedPerson, onSelectPerson, onPersonNavigate }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people.slice(0, 5);

    return people
      .filter((person) => {
        const haystack = [person.nickname, person.displayName, person.githubId, person.track]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [people, query]);

  function selectPerson(person) {
    onSelectPerson(person);
    setQuery(displayName(person));
    onPersonNavigate?.(person);
  }

  return (
    <Surface glow="purple" className="relative z-10 p-2">
      <label className="sr-only" htmlFor="person-search">
        사람 검색
      </label>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input
          id="person-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="닉네임 또는 GitHub ID 검색"
          className="min-h-12 min-w-0 flex-1 rounded-md border border-rp-line bg-rp-bg px-4 text-sm text-rp-text outline-none transition focus:border-rp-purple"
        />
        <div className="rounded-md bg-rp-panel2 px-4 py-3 text-xs text-rp-muted md:min-w-48">
          {selectedPerson ? (
            <>
              <span className="block font-semibold text-rp-text">{displayName(selectedPerson)}</span>
              <span>{displayMeta(selectedPerson)}</span>
            </>
          ) : (
            "검색 결과를 선택하면 상세 이동 이벤트가 준비됩니다."
          )}
        </div>
      </div>
      {query.trim() && matches.length > 0 ? (
        <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg border border-rp-line bg-rp-panel shadow-glow-purple">
          {matches.map((person) => (
            <button
              key={person.githubId}
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-rp-panel2"
              onClick={() => selectPerson(person)}
            >
              <span>
                <span className="block text-sm font-semibold text-rp-text">{displayName(person)}</span>
                <span className="text-xs text-rp-subtle">{displayMeta(person)}</span>
              </span>
              <span className="text-xs text-rp-purple">@{person.githubId}</span>
            </button>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}
