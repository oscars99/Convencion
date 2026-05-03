export type AreaType = "lobby" | "rampa" | "escaleras" | "entrada" | "otro";

export type Person = {
  person_id: string;
  name: string;
  active?: boolean;
};

export type Shift = {
  time: string;
  person_id: string;
  person_name: string;
};

export type Area = {
  area_name: string;
  area_type: AreaType;
  shifts: Shift[];
};

export type Schedule = {
  schedule_id: string;
  day: "viernes" | "sabado" | "domingo" | string;
  source_note?: string;
  areas: Area[];
};

export type ScheduleData = {
  version: string;
  language: string;
  time_format: string;
  people: Person[];
  schedules: Schedule[];
};

export type Assignment = {
  assignment_id: string;
  day: string;
  area_name: string;
  area_type: AreaType;
  time: string;
  person_id: string;
  person_name: string;
  active: boolean;
};

export type ChangeLog = {
  change_id: string;
  action: "update_assignment" | "add_person" | "edit_person" | "deactivate_person";
  day?: string;
  area_name?: string;
  area_type?: AreaType;
  time?: string;
  previous_person_id?: string;
  previous_person_name?: string;
  new_person_id?: string;
  new_person_name?: string;
  updated_by: string;
  updated_at: string;
};
