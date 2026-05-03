import type { Assignment, Person, ScheduleData } from "../types/schedule";

export const dayOrder = ["viernes", "sabado", "domingo"];
export const areaTypeOrder = ["lobby", "rampa", "escaleras", "entrada", "otro"];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function slugifyPersonId(name: string): string {
  return "person_" + normalizeText(name)
    .replace(/\((.*?)\)/g, "$1")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function formatDay(day: string): string {
  const map: Record<string, string> = {
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo"
  };
  return map[day] ?? day;
}

export function formatAreaType(type: string): string {
  const map: Record<string, string> = {
    lobby: "Lobby",
    rampa: "Rampa",
    escaleras: "Escaleras",
    entrada: "Entrada",
    otro: "Otro"
  };
  return map[type] ?? type;
}

export function formatTime(time: string): string {
  const [hour, minute] = time.split(":");
  const h = Number(hour);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function getAreaTypeClass(type: string): string {
  switch (type) {
    case "lobby": return "badge lobby";
    case "rampa": return "badge rampa";
    case "escaleras": return "badge escaleras";
    case "entrada": return "badge entrada";
    default: return "badge otro";
  }
}

export function buildAssignments(data: ScheduleData): Assignment[] {
  const assignments: Assignment[] = [];

  data.schedules.forEach((schedule) => {
    schedule.areas.forEach((area) => {
      area.shifts.forEach((shift) => {
        const safeArea = area.area_name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const safeTime = shift.time.replace(/:/g, "");
        assignments.push({
          assignment_id: `assignment_${schedule.day}_${safeArea}_${safeTime}_${shift.person_id}`,
          day: schedule.day,
          area_name: area.area_name,
          area_type: area.area_type,
          time: shift.time,
          person_id: shift.person_id,
          person_name: shift.person_name,
          active: true
        });
      });
    });
  });

  return sortAssignments(assignments);
}

export function sortAssignments(assignments: Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => {
    const dayCompare = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayCompare !== 0) return dayCompare;

    const typeCompare = areaTypeOrder.indexOf(a.area_type) - areaTypeOrder.indexOf(b.area_type);
    if (typeCompare !== 0) return typeCompare;

    const areaCompare = a.area_name.localeCompare(b.area_name);
    if (areaCompare !== 0) return areaCompare;

    return a.time.localeCompare(b.time);
  });
}

export function uniquePeopleFromAssignments(assignments: Assignment[], originalPeople: Person[]): Person[] {
  const map = new Map<string, Person>();

  originalPeople.forEach((p) => {
    map.set(p.person_id, { ...p, active: p.active !== false });
  });

  assignments.forEach((a) => {
    if (!map.has(a.person_id)) {
      map.set(a.person_id, {
        person_id: a.person_id,
        name: a.person_name,
        active: true
      });
    }
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findConflicts(
  assignments: Assignment[],
  personId: string,
  day: string,
  time: string,
  currentAssignmentId?: string
): Assignment[] {
  return assignments.filter((a) =>
    a.active &&
    a.person_id === personId &&
    a.day === day &&
    a.time === time &&
    a.assignment_id !== currentAssignmentId
  );
}

export function groupAssignmentsByDay(assignments: Assignment[]) {
  return dayOrder.reduce<Record<string, Assignment[]>>((acc, day) => {
    acc[day] = sortAssignments(assignments.filter((a) => a.day === day && a.active));
    return acc;
  }, {});
}

export function groupAssignmentsByArea(assignments: Assignment[]) {
  const groups = new Map<string, Assignment[]>();

  sortAssignments(assignments).forEach((assignment) => {
    const key = assignment.area_name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(assignment);
  });

  return [...groups.entries()].map(([areaName, items]) => ({
    areaName,
    areaType: items[0]?.area_type ?? "otro",
    items: items.sort((a, b) => a.time.localeCompare(b.time))
  }));
}
