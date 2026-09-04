/**
 * React binding for a repository: loads once, keeps records in state, persists on change
 * and surfaces storage problems as a user-visible notice instead of a crash.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Entity, Repository } from "../lib/repository.js";
import type { StorageStatus } from "../lib/storage.js";

export interface CollectionState<Record_ extends Entity> {
  records: Record_[];
  loading: boolean;
  status: StorageStatus;
  notice?: string;
  create: (input: Omit<Record_, keyof Entity>) => Record_;
  update: (id: string, changes: Partial<Omit<Record_, keyof Entity>>) => void;
  remove: (id: string) => void;
  replaceAll: (records: Record_[]) => void;
  dismissNotice: () => void;
}

export function useCollection<Record_ extends Entity>(
  repository: Repository<Record_>,
): CollectionState<Record_> {
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StorageStatus>("empty");
  const [notice, setNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    const outcome = repository.load();
    setRecords(outcome.records);
    setStatus(outcome.status);
    setNotice(outcome.message);
    setLoading(false);
  }, [repository]);

  const commit = useCallback(
    (next: Record_[]) => {
      setRecords(next);
      const saved = repository.save(next);
      if (!saved.saved) {
        setStatus("unavailable");
        setNotice(saved.message);
      }
    },
    [repository],
  );

  const create = useCallback(
    (input: Omit<Record_, keyof Entity>) => {
      const created = repository.create(records, input);
      commit(created.records);
      return created.record;
    },
    [commit, records, repository],
  );

  const update = useCallback(
    (id: string, changes: Partial<Omit<Record_, keyof Entity>>) => {
      commit(repository.update(records, id, changes));
    },
    [commit, records, repository],
  );

  const remove = useCallback(
    (id: string) => {
      commit(repository.remove(records, id));
    },
    [commit, records, repository],
  );

  const replaceAll = useCallback(
    (next: Record_[]) => {
      commit(repository.replaceAll(next));
    },
    [commit, repository],
  );

  return useMemo(
    () => ({
      records,
      loading,
      status,
      ...(notice === undefined ? {} : { notice }),
      create,
      update,
      remove,
      replaceAll,
      dismissNotice: () => setNotice(undefined),
    }),
    [create, loading, notice, records, remove, replaceAll, status, update],
  );
}
