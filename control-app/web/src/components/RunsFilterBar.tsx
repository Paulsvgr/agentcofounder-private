import { Link } from "react-router-dom";
import type { ExperimentListEntry, RunStatus } from "../lib/api.js";

type TriFilter = "all" | "yes" | "no";

export type RunsFilterOptions = {
  providers: string[];
  models: string[];
  authors: string[];
  thinking: string[];
  arms: string[];
  interventions: string[];
};

export type RunsFilterState = {
  experiment: string;
  status: string;
  provider: string;
  model: string;
  author: string;
  search: string;
  analysis: TriFilter;
  mega: TriFilter;
  manifest: TriFilter;
  result: TriFilter;
  thinking: string;
  arm: string;
  intervention: string;
  dateFrom: string;
  dateTo: string;
  minCalls: string;
  minWeighted: string;
  minOutput: string;
};

type UrlFilterKey = "experiment" | "status" | "provider" | "model" | "author" | "q";

type ActiveChip = { key: UrlFilterKey; label: string; value: string };

type Props = {
  experiments: ExperimentListEntry[];
  filterOptions: RunsFilterOptions;
  experimentFilter: string;
  statusFilter: string;
  providerFilter: string;
  modelFilter: string;
  authorFilter: string;
  search: string;
  analysisFilter: TriFilter;
  megaFilter: TriFilter;
  manifestFilter: TriFilter;
  resultFilter: TriFilter;
  thinkingFilter: string;
  armFilter: string;
  interventionFilter: string;
  dateFrom: string;
  dateTo: string;
  minCalls: string;
  minWeighted: string;
  minOutput: string;
  showAdvanced: boolean;
  activeUrlFilters: ActiveChip[];
  activeAdvancedCount: number;
  hasActiveFilters: boolean;
  onUrlFilter: (key: UrlFilterKey, value: string) => void;
  onAnalysisFilter: (value: TriFilter) => void;
  onMegaFilter: (value: TriFilter) => void;
  onManifestFilter: (value: TriFilter) => void;
  onResultFilter: (value: TriFilter) => void;
  onThinkingFilter: (value: string) => void;
  onArmFilter: (value: string) => void;
  onInterventionFilter: (value: string) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onMinCalls: (value: string) => void;
  onMinWeighted: (value: string) => void;
  onMinOutput: (value: string) => void;
  onToggleAdvanced: () => void;
  onClearAll: () => void;
};

const STATUS_QUICK: Array<{ value: RunStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "partial", label: "Partial" },
];

const ANALYSIS_OPTIONS: Array<{ value: TriFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "yes", label: "Analyzed" },
  { value: "no", label: "Not analyzed" },
];

const MEGA_OPTIONS: Array<{ value: TriFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "yes", label: "Mega only" },
  { value: "no", label: "No mega" },
];

const PRESENCE_OPTIONS: Array<{ value: TriFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "yes", label: "Present" },
  { value: "no", label: "Missing" },
];

function selectOptions(values: string[]): Array<{ value: string; label: string }> {
  return [{ value: "all", label: "All" }, ...values.map((value) => ({ value, label: value }))];
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="runs-filter-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RunsFilterBar({
  experiments,
  filterOptions,
  experimentFilter,
  statusFilter,
  providerFilter,
  modelFilter,
  authorFilter,
  search,
  analysisFilter,
  megaFilter,
  manifestFilter,
  resultFilter,
  thinkingFilter,
  armFilter,
  interventionFilter,
  dateFrom,
  dateTo,
  minCalls,
  minWeighted,
  minOutput,
  showAdvanced,
  activeUrlFilters,
  activeAdvancedCount,
  hasActiveFilters,
  onUrlFilter,
  onAnalysisFilter,
  onMegaFilter,
  onManifestFilter,
  onResultFilter,
  onThinkingFilter,
  onArmFilter,
  onInterventionFilter,
  onDateFrom,
  onDateTo,
  onMinCalls,
  onMinWeighted,
  onMinOutput,
  onToggleAdvanced,
  onClearAll,
}: Props) {
  return (
    <div className="runs-filter-panel">
      <div className="runs-filter-top">
        <input
          className="station-search runs-filter-search"
          type="search"
          placeholder="Search runs, models, authors, comments…"
          value={search}
          onChange={(event) => onUrlFilter("q", event.target.value)}
        />
        <div className="segment-control segment-control-compact" role="group" aria-label="Status">
          {STATUS_QUICK.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment-btn${statusFilter === option.value ? " active" : ""}`}
              onClick={() => onUrlFilter("status", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="runs-filter-grid runs-filter-grid-primary">
        {experiments.length > 0 ? (
          <FilterSelect
            label="Experiment"
            value={experimentFilter}
            onChange={(value) => onUrlFilter("experiment", value)}
            options={[
              { value: "all", label: "All experiments" },
              ...experiments.map((entry) => ({
                value: entry.id,
                label: `${entry.title} (${entry.run_count})`,
              })),
            ]}
          />
        ) : null}
        {filterOptions.providers.length > 0 ? (
          <FilterSelect
            label="Provider"
            value={providerFilter}
            onChange={(value) => onUrlFilter("provider", value)}
            options={selectOptions(filterOptions.providers)}
          />
        ) : null}
        {filterOptions.models.length > 0 ? (
          <FilterSelect
            label="Model"
            value={modelFilter}
            onChange={(value) => onUrlFilter("model", value)}
            options={selectOptions(filterOptions.models)}
          />
        ) : null}
        {filterOptions.authors.length > 0 ? (
          <FilterSelect
            label="Author"
            value={authorFilter}
            onChange={(value) => onUrlFilter("author", value)}
            options={selectOptions(filterOptions.authors)}
          />
        ) : null}
      </div>

      <div className="runs-filter-actions">
        <button
          type="button"
          className={`button-link secondary runs-advanced-toggle${showAdvanced ? " active" : ""}`}
          onClick={onToggleAdvanced}
        >
          {showAdvanced ? "Fewer filters" : "More filters"}
          {activeAdvancedCount > 0 ? (
            <span className="filter-count-badge">{activeAdvancedCount}</span>
          ) : null}
        </button>
        {hasActiveFilters ? (
          <button type="button" className="button-link secondary runs-clear" onClick={onClearAll}>
            Reset
          </button>
        ) : null}
      </div>

      {activeUrlFilters.length > 0 ? (
        <div className="runs-filter-chips">
          {activeUrlFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="runs-filter-chip"
              onClick={() => onUrlFilter(chip.key, chip.key === "q" ? "" : "all")}
            >
              <span className="runs-filter-chip-label">{chip.label}</span>
              <span className="runs-filter-chip-value">{chip.value}</span>
              <span className="runs-filter-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ))}
          {experimentFilter !== "all" ? (
            <Link to="/experiments" className="runs-filter-chip-link">
              Manage experiments
            </Link>
          ) : null}
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="runs-advanced">
          <div className="runs-filter-grid">
            {filterOptions.thinking.length > 0 ? (
              <FilterSelect
                label="Thinking"
                value={thinkingFilter}
                onChange={onThinkingFilter}
                options={selectOptions(filterOptions.thinking)}
              />
            ) : null}
            {filterOptions.arms.length > 0 ? (
              <FilterSelect
                label="Arm"
                value={armFilter}
                onChange={onArmFilter}
                options={selectOptions(filterOptions.arms)}
              />
            ) : null}
            {filterOptions.interventions.length > 0 ? (
              <FilterSelect
                label="Intervention"
                value={interventionFilter}
                onChange={onInterventionFilter}
                options={selectOptions(filterOptions.interventions)}
              />
            ) : null}
            <FilterSelect
              label="Analyzed"
              value={analysisFilter}
              onChange={(value) => onAnalysisFilter(value as TriFilter)}
              options={ANALYSIS_OPTIONS}
            />
            <FilterSelect
              label="Mega call"
              value={megaFilter}
              onChange={(value) => onMegaFilter(value as TriFilter)}
              options={MEGA_OPTIONS}
            />
            <FilterSelect
              label="Manifest"
              value={manifestFilter}
              onChange={(value) => onManifestFilter(value as TriFilter)}
              options={PRESENCE_OPTIONS}
            />
            <FilterSelect
              label="Result"
              value={resultFilter}
              onChange={(value) => onResultFilter(value as TriFilter)}
              options={PRESENCE_OPTIONS}
            />
            <label className="runs-filter-field">
              Date from
              <input type="date" value={dateFrom} onChange={(event) => onDateFrom(event.target.value)} />
            </label>
            <label className="runs-filter-field">
              Date to
              <input type="date" value={dateTo} onChange={(event) => onDateTo(event.target.value)} />
            </label>
            <label className="runs-filter-field">
              Min calls
              <input
                type="number"
                min={0}
                placeholder="Any"
                value={minCalls}
                onChange={(event) => onMinCalls(event.target.value)}
              />
            </label>
            <label className="runs-filter-field">
              Min weighted
              <input
                type="number"
                min={0}
                placeholder="Any"
                value={minWeighted}
                onChange={(event) => onMinWeighted(event.target.value)}
              />
            </label>
            <label className="runs-filter-field">
              Min output tokens
              <input
                type="number"
                min={0}
                placeholder="Any"
                value={minOutput}
                onChange={(event) => onMinOutput(event.target.value)}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
