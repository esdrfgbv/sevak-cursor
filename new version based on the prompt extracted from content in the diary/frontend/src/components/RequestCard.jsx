const priorityTone = {
  CRITICAL: "border-error bg-error/15 text-error",
  HIGH: "border-error bg-error/10 text-error",
  MEDIUM: "border-yellow bg-yellow/10 text-yellow",
  LOW: "border-primary bg-primary/10 text-primary",
};

function formatImageCheck(request) {
  const status = request.image_verification_status || "not_submitted";
  const reason = request.image_verification_reason || "";

  if (status === "verified") {
    return "verified";
  }

  if (status === "low_confidence") {
    return "review: low confidence";
  }

  if (status === "description_mismatch") {
    return "review: text vs image";
  }

  if (status === "rejected") {
    if (/signature verification/i.test(reason)) {
      const match = reason.match(/^(PNG|JPEG|WebP)/i);
      return match ? `rejected: bad ${match[1].toLowerCase()} file` : "rejected: invalid image file";
    }
    if (/larger than 2 mb/i.test(reason)) {
      return "rejected: file too large";
    }
    if (/base64/i.test(reason)) {
      return "rejected: corrupt image";
    }
    if (/jpeg, png, and webp/i.test(reason)) {
      return "rejected: unsupported format";
    }
    if (/non-disaster|does not appear/i.test(reason)) {
      return "rejected: not disaster image";
    }
    return "rejected: check reason";
  }

  return status.replace("_", " ");
}

function formatImageReason(request) {
  const status = request.image_verification_status || "not_submitted";
  const reason = request.image_verification_reason;

  if (!reason) {
    return null;
  }

  if (status === "rejected") {
    return `Image rejected because ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`;
  }

  if (status === "low_confidence") {
    return `Low confidence in disaster detection: ${reason}`;
  }

  if (status === "description_mismatch") {
    return `Verification mismatch: ${reason}`;
  }

  return reason;
}

export default function RequestCard({ request, compact = false, actions = null, footer = null }) {
  const tone = priorityTone[request.priority_level] || priorityTone.LOW;
  const imageReason = formatImageReason(request);

  return (
    <article className="rounded-xl bg-surface-container-low p-5 shadow-tactical transition hover:bg-surface-container">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <span className={`inline-flex rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${tone}`}>
            {request.priority_level} Priority
          </span>
          <div>
            <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">{request.title}</h3>
            <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">{request.incident_type}</p>
          </div>
        </div>
        <div className="rounded bg-surface-container-high px-3 py-2 text-right">
          <div className="font-headline text-2xl font-extrabold text-primary">{request.priority_score}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Score</div>
        </div>
      </div>
      <p className={`${compact ? "line-clamp-2" : ""} text-sm leading-6 text-on-surface-variant`}>{request.description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="People" value={request.people_count} />
        <Stat label="State" value={request.status} />
        <Stat label="Cluster" value={`+${request.cluster_boost}`} />
        <Stat label="Verification Boost" value={`+${request.severity_support_points || 0}`} />
        <Stat label="Confirmations" value={request.supporter_count || 0} />
        <Stat label="Image Check" value={formatImageCheck(request)} />
        <Stat label="Skills" value={request.skills?.map((skill) => skill.name).join(", ") || "General"} />
      </div>
      {imageReason ? <p className="mt-3 text-xs text-on-surface-variant">{imageReason}</p> : null}
      {request.image_url ? (
        <img src={request.image_url} alt={`Evidence for ${request.title}`} className="mt-4 h-36 w-full rounded object-cover" />
      ) : null}
      {request.assignments?.length ? (
        <div className="mt-5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Assignments</p>
          <div className="flex flex-wrap gap-2">
            {request.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded bg-surface-container-high px-3 py-2 text-xs text-on-surface">
                <div>
                  {assignment.volunteer?.name || `Volunteer ${assignment.volunteer_id}`} | {assignment.status}
                </div>
                <div className="mt-1 text-on-surface-variant">
                  Match {Math.round((assignment.score || 0) * 100)} | {assignment.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded bg-surface-container-high p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</div>
      <div className="mt-1 text-sm font-semibold text-on-surface">{value}</div>
    </div>
  );
}
