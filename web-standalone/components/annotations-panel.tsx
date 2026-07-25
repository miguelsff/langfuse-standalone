import { useState, type FormEvent } from "react";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

type TargetType = "TRACE" | "OBSERVATION" | "SESSION";

export function AnnotationsPanel({
  targetType,
  targetId,
}: {
  targetType: TargetType;
  targetId: string;
}) {
  const [comment, setComment] = useState("");
  const [scoreName, setScoreName] = useState("quality");
  const [scoreValue, setScoreValue] = useState("1");
  const [uploading, setUploading] = useState(false);
  const utilities = api.useUtils();
  const annotations = api.annotations.get.useQuery({ targetType, targetId });
  const refresh = () =>
    utilities.annotations.get.invalidate({ targetType, targetId });
  const bookmark = api.annotations.toggleBookmark.useMutation({
    onSuccess: refresh,
  });
  const deletion = api.annotations.setDeleted.useMutation({
    onSuccess: refresh,
  });
  const createComment = api.annotations.createComment.useMutation({
    onSuccess: async () => {
      setComment("");
      await refresh();
    },
  });
  const deleteComment = api.annotations.deleteComment.useMutation({
    onSuccess: refresh,
  });
  const createScore = api.annotations.createScore.useMutation({
    onSuccess: refresh,
  });
  const deleteScore = api.annotations.deleteScore.useMutation({
    onSuccess: refresh,
  });

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (comment.trim()) {
      createComment.mutate({ targetType, targetId, content: comment });
    }
  };
  const submitScore = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(scoreValue);
    if (scoreName.trim() && Number.isFinite(value)) {
      createScore.mutate({
        targetType,
        targetId,
        name: scoreName,
        dataType: "NUMERIC",
        value,
      });
    }
  };

  return (
    <section className="annotation-panel">
      <div className="section-heading">
        <h2>Local annotations</h2>
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => bookmark.mutate({ targetType, targetId })}
            type="button"
          >
            {annotations.data?.bookmarked ? "Remove bookmark" : "Bookmark"}
          </button>
          <button
            className="button danger"
            onClick={() =>
              deletion.mutate({
                targetType,
                targetId,
                deleted: !annotations.data?.deleted,
              })
            }
            type="button"
          >
            {annotations.data?.deleted ? "Restore" : "Hide locally"}
          </button>
        </div>
      </div>

      <div className="annotation-columns">
        <div>
          <h3>Comments</h3>
          <form className="stack" onSubmit={submitComment}>
            <textarea
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a local comment"
              rows={3}
              value={comment}
            />
            <button className="button" disabled={createComment.isPending}>
              Add comment
            </button>
          </form>
          <div className="stack compact">
            {annotations.data?.comments.map((item) => (
              <article className="annotation-item" key={item.id}>
                <p>{item.content}</p>
                <small>{formatDate(item.createdAt)}</small>
                <button
                  className="text-button danger-text"
                  onClick={() => deleteComment.mutate({ id: item.id })}
                  type="button"
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h3>Scores</h3>
          <form className="inline-form" onSubmit={submitScore}>
            <input
              aria-label="Score name"
              onChange={(event) => setScoreName(event.target.value)}
              value={scoreName}
            />
            <input
              aria-label="Score value"
              onChange={(event) => setScoreValue(event.target.value)}
              step="any"
              type="number"
              value={scoreValue}
            />
            <button className="button" disabled={createScore.isPending}>
              Save
            </button>
          </form>
          <div className="stack compact">
            {annotations.data?.scores.map((item) => (
              <article className="annotation-item" key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.value ?? item.stringValue ?? "—"}</span>
                <small>
                  {item.source} · {formatDate(item.createdAt)}
                </small>
                <button
                  className="text-button danger-text"
                  onClick={() => deleteScore.mutate({ id: item.id })}
                  type="button"
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <h3>Local media</h3>
        <label className="button secondary">
          {uploading ? "Uploading…" : "Attach file"}
          <input
            disabled={uploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const response = await fetch(
                  `/api/media/upload?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
                  {
                    method: "POST",
                    headers: {
                      "content-type": file.type || "application/octet-stream",
                      "x-file-name": encodeURIComponent(file.name),
                    },
                    body: file,
                  },
                );
                if (!response.ok) throw new Error("Upload failed");
                await refresh();
              } finally {
                setUploading(false);
                event.target.value = "";
              }
            }}
            style={{ display: "none" }}
            type="file"
          />
        </label>
        <div className="stack compact">
          {annotations.data?.media.map((item) => (
            <a
              className="annotation-item link"
              href={`/api/media/${item.id}`}
              key={item.id}
            >
              {item.fileName} · {Math.ceil(item.size / 1024)} KB
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
