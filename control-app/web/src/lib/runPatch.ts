import type {
  HackathonRunData,
  HackathonRunRecord,
  RunClassification,
  RunExport,
  RunHuman,
  AppRubricScores,
} from "../types/runExport";
import { deriveFlags } from "./classification";

export type HumanPatch = {
  app_rubric: AppRubricScores | null;
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
};

export function patchRunHumanFields(
  run: HackathonRunRecord,
  human: HumanPatch,
): HackathonRunData {
  const data = structuredClone(run.data);
  data.app_rubric = human.app_rubric;
  data.app_rating = human.app_rating;
  data.app_comment = human.app_comment;
  data.run_comment = human.run_comment;
  data.human = {
    app_rubric: human.app_rubric,
    app_rating: human.app_rating,
    app_comment: human.app_comment,
    run_comment: human.run_comment,
  };
  return data;
}

export function patchRunExportHumanAndClassification(
  run: HackathonRunRecord,
  exportDoc: RunExport,
  human: HumanPatch,
  classification: RunClassification,
): HackathonRunData {
  const data = patchRunExportAndHuman(run, exportDoc, human);
  data.classification = classification;
  data.export = {
    ...data.export,
    meta: {
      ...data.export.meta,
      classification,
    },
  };
  data.flags = deriveFlags(classification, human.run_comment, human.app_comment);
  return data;
}

export function patchRunExportAndHuman(
  run: HackathonRunRecord,
  exportDoc: RunExport,
  human: HumanPatch,
): HackathonRunData {
  const data = structuredClone(run.data);
  data.export = exportDoc;
  if ("manifest" in (data.export as object)) {
    delete (data.export as Record<string, unknown>).manifest;
  }
  data.run_id = exportDoc.meta.run_id;
  data.git_branch = exportDoc.meta.git_branch;
  data.git_commit = exportDoc.meta.git_commit;
  data.approach_kind = exportDoc.meta.approach;
  data.app_rubric = human.app_rubric;
  data.app_rating = human.app_rating;
  data.app_comment = human.app_comment;
  data.run_comment = human.run_comment;
  data.human = {
    app_rubric: human.app_rubric,
    app_rating: human.app_rating,
    app_comment: human.app_comment,
    run_comment: human.run_comment,
  };
  return data;
}

export function humanFromRun(run: HackathonRunRecord): RunHuman {
  const h = run.data.human;
  return {
    app_rubric: h?.app_rubric ?? run.data.app_rubric ?? null,
    app_rating: h?.app_rating ?? run.data.app_rating ?? null,
    app_comment: h?.app_comment ?? run.data.app_comment ?? "",
    run_comment: h?.run_comment ?? run.data.run_comment ?? "",
  };
}
