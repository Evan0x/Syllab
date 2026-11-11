import check from "../../assets/login/check.svg"
import sparkles from "../../assets/login/sparkles.svg"

const days = [
  { label: "M", date: "16", selected: false },
  { label: "T", date: "17", selected: false },
  { label: "W", date: "18", selected: true },
  { label: "T", date: "19", selected: false },
  { label: "F", date: "20", selected: false },
]

const items = [
  { course: "BIO 201", title: "Cell biology review", when: "Today", bar: "var(--auth-indigo)" },
  { course: "ENG 104", title: "Essay outline", when: "Tomorrow", bar: "var(--auth-bar)" },
]

export function SemesterPreview() {
  return (
    <div className="flex w-full max-w-[528px] flex-col gap-9">
      <div className="flex flex-col gap-[18px]">
        <p className="flex items-center gap-[7px] text-[10px] font-semibold tracking-[1.2px] text-[var(--auth-indigo)]">
          <img src={sparkles} alt="" width="16" height="16" />
          A LITTLE CLARITY GOES A LONG WAY
        </p>
        <h2 className="text-[46px] leading-[54px] font-semibold tracking-[-1.8px]">
          A clearer plan.
          <br />
          <span className="text-[var(--auth-indigo)]">A calmer semester.</span>
        </h2>
        <p className="text-[15px] leading-[25px] text-[var(--auth-muted)]">
          Turn your syllabi into a plan you can follow.
          <br />
          Make room for the work that matters.
        </p>
      </div>
      <div
        className="flex flex-col gap-5 rounded-[12px] border border-[var(--auth-card-line)] bg-[var(--auth-surface)] px-6 py-[22px]"
        style={{ boxShadow: "var(--auth-shadow)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[16px] leading-6 font-semibold">Your week, in focus</p>
            <p className="mt-[3px] text-[12px] leading-[18px] text-[var(--auth-muted)]">
              One plan. Everything in its place.
            </p>
          </div>
          <span className="rounded-[6px] bg-[var(--auth-badge)] px-[9px] py-[5px] text-[10px] leading-4 font-medium text-[var(--auth-indigo)]">
            This week
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {days.map((day) => (
            <div
              key={`${day.label}-${day.date}`}
              className={`flex flex-col items-center gap-1 rounded-[8px] py-[9px] ${
                day.selected
                  ? "bg-[var(--auth-selected)] text-[var(--auth-indigo)]"
                  : "bg-[var(--auth-well)]"
              }`}
            >
              <span
                className={`text-[10px] leading-[14px] font-medium ${day.selected ? "" : "text-[var(--auth-muted)]"}`}
              >
                {day.label}
              </span>
              <span className="text-[14px] leading-5 font-semibold">{day.date}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.title} className="flex items-center gap-2.5">
              <span className="h-8 w-[3px] shrink-0 rounded-[1.5px]" style={{ background: item.bar }} />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] leading-[13px] font-semibold text-[var(--auth-muted)]">{item.course}</p>
                <p className="text-[12px] leading-[18px] font-medium">{item.title}</p>
              </div>
              <p className="text-[10px] leading-4 font-medium text-[var(--auth-muted)]">{item.when}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-[12px] leading-5 text-[var(--auth-muted)]">
        <img src={check} alt="" width="16" height="16" />
        From syllabus to schedule, without the busywork.
      </p>
    </div>
  )
}
