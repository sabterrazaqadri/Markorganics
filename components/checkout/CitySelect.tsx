import { PK_CITIES } from "@/lib/cities";

interface Props {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

/**
 * Searchable city picker using a native <datalist>: typing filters the list,
 * and any free text is accepted for towns not listed.
 */
export function CitySelect({ value, onChange, error }: Props) {
  return (
    <div>
      <label htmlFor="city" className="label">
        City
      </label>
      <input
        id="city"
        name="city"
        list="pk-cities"
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="address-level2"
        placeholder="Start typing, e.g. Karachi"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "city-error" : "city-hint"}
        required
      />
      <datalist id="pk-cities">
        {PK_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {error ? (
        <p id="city-error" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id="city-hint" className="mt-1 text-xs text-ink-soft">
          Not in the list? Type your town name.
        </p>
      )}
    </div>
  );
}
