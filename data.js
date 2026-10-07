/* jonheg.fit data: exercise library, program templates, shooting drills, nutrition rules, sources.
   Drill benchmarks are only those published by the cited source. */
window.FIT_DATA = (() => {
  // unit: wr = weight x reps, r = reps only, t = seconds, d = distance+time, carry = weight + distance
  const EX = [
    // Lower body strength
    { id: "trap-dl", name: "Trap Bar Deadlift", cat: "lower", unit: "wr", rep: [3, 6], inc: 10, cue: "Hips back, chest tall, push the floor away. Stop each rep dead.", why: "Hinge strength drives your first step out of a box and protects the low back on long match days.", swaps: ["rdl", "kb-dl"] },
    { id: "back-squat", name: "Back Squat", cat: "lower", unit: "wr", rep: [4, 8], inc: 10, cue: "Brace, sit between your hips, knees track over toes.", why: "Leg strength lets you drop low into ports and stand back up without wasting time.", swaps: ["goblet-squat", "leg-press", "safety-squat"] },
    { id: "safety-squat", name: "Safety Bar Squat", cat: "lower", unit: "wr", rep: [5, 8], inc: 10, cue: "Hands on the handles, stay upright, drive up through mid-foot.", why: "Squat strength with less shoulder strain, kind to older joints.", swaps: ["back-squat", "goblet-squat"] },
    { id: "front-squat", name: "Front Squat", cat: "lower", unit: "wr", rep: [4, 6], inc: 10, cue: "Elbows high, torso upright.", why: "Upright posture strength, the same torso angle you hold while shooting low.", swaps: ["goblet-squat", "back-squat"] },
    { id: "goblet-squat", name: "Goblet Squat", cat: "lower", unit: "wr", rep: [8, 12], inc: 5, cue: "Hold the bell at your chest, elbows inside knees at the bottom.", why: "Teaches a deep, balanced squat for low ports and kneeling positions.", swaps: ["back-squat", "leg-press"] },
    { id: "leg-press", name: "Leg Press", cat: "lower", unit: "wr", rep: [8, 12], inc: 10, cue: "Full depth without the low back rolling off the pad.", why: "Leg volume with low skill demand.", swaps: ["goblet-squat"] },
    { id: "rdl", name: "Romanian Deadlift", cat: "lower", unit: "wr", rep: [6, 10], inc: 10, cue: "Soft knees, slide the bar down the thighs, feel the hamstrings load.", why: "Hamstrings are the brakes when you stop hard in a shooting position.", swaps: ["kb-dl", "trap-dl"] },
    { id: "kb-dl", name: "Kettlebell Deadlift", cat: "lower", unit: "wr", rep: [8, 12], inc: 5, cue: "Hinge, flat back, stand tall and squeeze glutes.", why: "Beginner friendly hinge.", swaps: ["rdl"] },
    { id: "bss", name: "Bulgarian Split Squat", cat: "single", unit: "wr", rep: [6, 10], inc: 5, perSide: true, cue: "Rear foot on bench, drop the back knee straight down.", why: "Single-leg strength for wide stances, leans, and pushing off one foot.", swaps: ["rev-lunge", "step-up"] },
    { id: "rev-lunge", name: "Reverse Lunge", cat: "single", unit: "wr", rep: [8, 10], inc: 5, perSide: true, cue: "Step back, front shin vertical, drive through the front heel.", why: "Trains stepping back out of a position under control.", swaps: ["bss"] },
    { id: "lat-lunge", name: "Lateral Lunge", cat: "single", unit: "wr", rep: [6, 8], inc: 5, perSide: true, cue: "Sit into one hip, other leg straight, push back to center.", why: "Side-to-side strength for moving between positions along a fault line.", swaps: ["cossack"] },
    { id: "cossack", name: "Cossack Squat", cat: "single", unit: "wr", rep: [6, 8], inc: 5, perSide: true, cue: "Wide stance, shift deep onto one leg, opposite toes up.", why: "Hip mobility and strength for low wide leans around barricades.", swaps: ["lat-lunge"] },
    { id: "step-up", name: "Box Step-Up", cat: "single", unit: "wr", rep: [6, 10], inc: 5, perSide: true, cue: "Whole foot on box, drive up without pushing off the back leg.", why: "Climbing onto stage props and uneven ground.", swaps: ["bss"] },
    { id: "sl-rdl", name: "Single-Leg RDL", cat: "single", unit: "wr", rep: [6, 10], inc: 5, perSide: true, cue: "Hips square, reach the free leg back, slow on the way down.", why: "Balance and hamstring control for shooting while off balance.", swaps: ["rdl"] },
    { id: "nordic", name: "Nordic Hamstring Curl", cat: "lower", unit: "r", rep: [3, 6], cue: "Kneel with ankles anchored, lower as slowly as you can.", why: "Strong hamstrings reduce pulls during sprints between positions.", swaps: ["ham-curl"] },
    { id: "ham-curl", name: "Hamstring Curl Machine", cat: "lower", unit: "wr", rep: [8, 12], inc: 5, cue: "Control the return, pause at full contraction.", why: "Knee health and deceleration.", swaps: ["nordic"] },
    { id: "calf-raise", name: "Calf Raise", cat: "lower", unit: "wr", rep: [10, 15], inc: 10, cue: "Full stretch at the bottom, pause at the top.", why: "Ankle stiffness for quick starts and stops on gravel.", swaps: [] },
    { id: "copenhagen", name: "Copenhagen Plank", cat: "core", unit: "t", rep: [15, 30], perSide: true, cue: "Top leg on bench, lift hips, hold a straight line.", why: "Groin strength for lateral pushes, a common strain in action sports.", swaps: ["side-plank"] },

    // Upper push
    { id: "bench", name: "Bench Press", cat: "push", unit: "wr", rep: [4, 8], inc: 5, cue: "Shoulder blades pinned, feet planted, bar to lower chest.", why: "Pressing strength supports a locked-out, stable arm drive on the gun.", swaps: ["db-bench", "pushup"] },
    { id: "db-bench", name: "Dumbbell Bench Press", cat: "push", unit: "wr", rep: [6, 12], inc: 5, cue: "Lower with control, press up and slightly in.", why: "Balanced pressing strength side to side.", swaps: ["bench", "pushup"] },
    { id: "incline-db", name: "Incline Dumbbell Press", cat: "push", unit: "wr", rep: [8, 12], inc: 5, cue: "30 degree bench, elbows about 45 degrees from the body.", why: "Upper chest and front delts, the muscles that hold the gun out.", swaps: ["db-bench"] },
    { id: "ohp", name: "Standing Overhead Press", cat: "push", unit: "wr", rep: [5, 8], inc: 5, cue: "Squeeze glutes, ribs down, press the bar straight up past the face.", why: "Shoulder strength and trunk stiffness for holding a rifle up under fatigue.", swaps: ["db-ohp", "landmine-press"] },
    { id: "db-ohp", name: "Seated Dumbbell Press", cat: "push", unit: "wr", rep: [8, 12], inc: 5, cue: "Back on pad, press up without arching.", why: "Shoulder endurance for long gun holds.", swaps: ["ohp"] },
    { id: "landmine-press", name: "Half-Kneeling Landmine Press", cat: "push", unit: "wr", rep: [6, 10], inc: 5, perSide: true, cue: "Kneel on the same side as the working arm, press up and forward.", why: "Shoulder-friendly press that trains the same kneeling base you shoot from.", swaps: ["db-ohp"] },
    { id: "pushup", name: "Push-Up", cat: "push", unit: "r", rep: [10, 25], cue: "Body in one line, chest to the floor.", why: "Pressing endurance and scapular control.", swaps: [] },
    { id: "dips", name: "Dips", cat: "push", unit: "r", rep: [6, 15], cue: "Slight forward lean, shoulders down.", why: "Triceps and chest strength for recoil control.", swaps: ["pushup"] },
    { id: "plyo-pushup", name: "Plyo Push-Up", cat: "power", unit: "r", rep: [4, 6], cue: "Explode so the hands leave the floor, land soft.", why: "Fast upper-body force, the kind used to punch the gun out on the draw.", swaps: ["mb-chest-pass"] },

    // Upper pull
    { id: "pullup", name: "Pull-Up", cat: "pull", unit: "r", rep: [4, 10], cue: "Dead hang, pull the chest toward the bar, full lockout at the bottom.", why: "Back and grip strength. Strong lats steady the gun through recoil.", swaps: ["lat-pd", "assist-pullup"] },
    { id: "assist-pullup", name: "Assisted Pull-Up", cat: "pull", unit: "wr", rep: [6, 10], inc: 10, cue: "Use as little assistance as you can for clean reps.", why: "Builds toward full pull-ups.", swaps: ["lat-pd"] },
    { id: "lat-pd", name: "Lat Pulldown", cat: "pull", unit: "wr", rep: [8, 12], inc: 10, cue: "Pull the bar to the upper chest, elbows down and in.", why: "Lat strength for recoil management.", swaps: ["pullup"] },
    { id: "db-row", name: "One-Arm Dumbbell Row", cat: "pull", unit: "wr", rep: [6, 12], inc: 5, perSide: true, cue: "Flat back, pull the elbow to the hip.", why: "Upper back strength to hold posture through a long stage.", swaps: ["cable-row"] },
    { id: "chest-row", name: "Chest-Supported Row", cat: "pull", unit: "wr", rep: [8, 12], inc: 5, cue: "Chest on pad, squeeze shoulder blades together.", why: "Back volume without loading the low back.", swaps: ["db-row"] },
    { id: "cable-row", name: "Seated Cable Row", cat: "pull", unit: "wr", rep: [8, 12], inc: 10, cue: "Tall chest, pull to the belly button.", why: "Posture and scapular control.", swaps: ["db-row"] },
    { id: "face-pull", name: "Face Pull", cat: "pull", unit: "wr", rep: [12, 20], inc: 5, cue: "Rope to the eyes, elbows high, thumbs back.", why: "Rear delts and rotator cuff for healthy shoulders under volume.", swaps: ["band-pullapart"] },
    { id: "band-pullapart", name: "Band Pull-Apart", cat: "pull", unit: "r", rep: [15, 25], cue: "Arms straight, pull the band to your chest.", why: "Shoulder health warm-up.", swaps: ["face-pull"] },
    { id: "rope-pullup", name: "Towel or Rope Pull-Up", cat: "grip", unit: "r", rep: [3, 8], cue: "Drape towels over the bar and grip them hard.", why: "Crushing grip under load, a staple of Mike Seeklander's grip work.", swaps: ["dead-hang"] },

    // Power, plyometric, change of direction
    { id: "box-jump", name: "Box Jump", cat: "power", unit: "r", rep: [3, 5], cue: "Jump, land soft and quiet, step down. Quality over height.", why: "Explosive first step out of the start position.", swaps: ["squat-jump"] },
    { id: "squat-jump", name: "Squat Jump", cat: "power", unit: "r", rep: [3, 5], cue: "Quarter squat then jump as high as possible, stick the landing.", why: "Leg power for faster starts.", swaps: ["box-jump"] },
    { id: "trap-jump", name: "Trap Bar Jump", cat: "power", unit: "wr", rep: [3, 5], inc: 10, cue: "Light load, about 20 to 30 percent of your deadlift, jump fast.", why: "Loaded power that carries straight into moving between positions.", swaps: ["squat-jump"] },
    { id: "skater", name: "Lateral Skater Bound", cat: "power", unit: "r", rep: [4, 6], perSide: true, cue: "Bound sideways onto one foot and hold the landing for 2 seconds.", why: "Teaches the hard lateral stop you need to shoot the instant you arrive.", swaps: [] },
    { id: "mb-rot-throw", name: "Med Ball Rotational Throw", cat: "power", unit: "wr", rep: [4, 6], inc: 2, perSide: true, cue: "Load the back hip, rotate and throw into the wall.", why: "Rotational speed for wide target transitions, especially with a long gun.", swaps: [] },
    { id: "mb-chest-pass", name: "Med Ball Chest Pass", cat: "power", unit: "wr", rep: [5, 8], inc: 2, cue: "Explode the ball off your chest into the wall.", why: "Fast arm extension for the presentation of the gun.", swaps: ["plyo-pushup"] },
    { id: "shuttle-5105", name: "5-10-5 Shuttle", cat: "cod", unit: "t", rep: [1, 1], cue: "Sprint 5 yd, plant, 10 yd back, plant, 5 yd. Stay low on the turns.", why: "Change of direction, the core movement skill of a USPSA stage.", swaps: [] },
    { id: "decel-drill", name: "Sprint to Stop", cat: "cod", unit: "r", rep: [4, 6], cue: "Sprint 5 to 10 yd and stop in a balanced shooting stance on a line. Freeze 2 seconds.", why: "Arriving balanced is what lets you shoot immediately. Practice stopping, not just running.", swaps: [] },
    { id: "lat-shuffle", name: "Lateral Shuffle to Stop", cat: "cod", unit: "r", rep: [4, 6], perSide: true, cue: "Shuffle 5 yd, plant the outside foot, freeze in a stance.", why: "Moving along a fault line and setting up fast.", swaps: [] },
    { id: "position-entry", name: "Position Entry and Exit (empty hands)", cat: "cod", unit: "r", rep: [5, 8], cue: "From standing, drop into kneel, then low squat, then stand and move off. Hands up in a shooting grip shape. No firearm in the gym.", why: "Getting into and out of awkward positions quickly. Do the same with your real gun only in dry fire at home or on the range.", swaps: [] },

    // Grip and carries
    { id: "farmer", name: "Farmer's Carry", cat: "grip", unit: "carry", rep: [30, 50], inc: 10, cue: "Heavy dumbbells, tall posture, short quick steps.", why: "Grip endurance and trunk stiffness. Recommended across shooter programs from Seeklander to the Modern Warrior plan.", swaps: ["suitcase"] },
    { id: "suitcase", name: "Suitcase Carry", cat: "grip", unit: "carry", rep: [20, 40], inc: 10, perSide: true, cue: "One heavy bell, do not lean toward it.", why: "Anti-lean core strength plus grip.", swaps: ["farmer"] },
    { id: "plate-pinch", name: "Plate Pinch Hold", cat: "grip", unit: "t", rep: [20, 45], cue: "Pinch two smooth plates together, hold.", why: "Thumb and finger strength for a high, tight pistol grip.", swaps: [] },
    { id: "gripper", name: "Hand Gripper (Captains of Crush style)", cat: "grip", unit: "r", rep: [5, 10], perSide: true, cue: "Full close, squeeze for 1 second.", why: "Crushing grip, the grip type that matters most for recoil control.", swaps: [] },
    { id: "dead-hang", name: "Dead Hang", cat: "grip", unit: "t", rep: [30, 60], cue: "Hang from the bar, shoulders slightly engaged.", why: "Grip endurance and shoulder health.", swaps: [] },
    { id: "thick-curl", name: "Thick-Grip Reverse Curl", cat: "grip", unit: "wr", rep: [8, 12], inc: 5, cue: "Fat grips on the bar or dumbbell, palms down.", why: "Forearm and wrist extensor strength for a stable wrist.", swaps: [] },

    // Core
    { id: "pallof", name: "Pallof Press", cat: "core", unit: "wr", rep: [8, 12], inc: 5, perSide: true, cue: "Stand side-on to the cable, press out and resist the rotation.", why: "Anti-rotation core, keeps the upper body quiet while the legs move.", swaps: [] },
    { id: "plank", name: "Plank (max tension)", cat: "core", unit: "t", rep: [30, 120], cue: "Squeeze everything as hard as you can.", why: "Seeklander ends most sessions with hard planks for a stable shooting platform.", swaps: [] },
    { id: "side-plank", name: "Side Plank", cat: "core", unit: "t", rep: [20, 45], perSide: true, cue: "Straight line from head to feet.", why: "Lateral trunk strength for leans.", swaps: [] },
    { id: "deadbug", name: "Dead Bug", cat: "core", unit: "r", rep: [6, 10], perSide: true, cue: "Low back flat, slow opposite arm and leg.", why: "Core control while the limbs move independently.", swaps: [] },
    { id: "ab-wheel", name: "Ab Wheel Rollout", cat: "core", unit: "r", rep: [6, 12], cue: "Ribs down, roll out only as far as you can keep a flat back.", why: "Anti-extension strength for a stable torso.", swaps: ["plank"] },
    { id: "hanging-knee", name: "Hanging Knee Raise", cat: "core", unit: "r", rep: [8, 15], cue: "No swinging, curl the pelvis up.", why: "Core plus grip in one movement.", swaps: [] },
    { id: "bird-dog", name: "Bird Dog", cat: "core", unit: "r", rep: [6, 10], perSide: true, cue: "Reach long, hips level.", why: "Spine stability, a good warm-up drill.", swaps: [] },

    // Conditioning (keep minimal)
    { id: "row-int", name: "Rower Intervals", cat: "cond", unit: "t", rep: [30, 60], cue: "Hard for the work interval, easy for double that time.", why: "Short repeated efforts like a stage, with recovery like the walk between stages.", swaps: ["bike-int"] },
    { id: "bike-int", name: "Assault or Spin Bike Intervals", cat: "cond", unit: "t", rep: [20, 40], cue: "All out for the work interval, then easy spin.", why: "Repeat sprint ability without pounding the joints.", swaps: ["row-int"] },
    { id: "sled", name: "Sled Push", cat: "cond", unit: "carry", rep: [20, 30], inc: 25, cue: "Low body angle, drive with short powerful steps.", why: "Acceleration strength with almost no injury risk.", swaps: [] },
    { id: "zone2", name: "Zone 2 Cardio (bike, incline walk, row)", cat: "cond", unit: "t", rep: [1200, 2400], cue: "You can talk in full sentences. Keep it easy.", why: "Aerobic base keeps you sharp through an all-day match. Seeklander builds most of his week on it.", swaps: [] },
    { id: "run", name: "Outdoor Run", cat: "cond", unit: "d", rep: [1, 3], cue: "Easy pace unless it is a planned interval day.", why: "Optional. Logged so it counts toward the week.", swaps: [] },
    { id: "ride", name: "Bike Ride", cat: "cond", unit: "d", rep: [5, 20], cue: "Easy to moderate effort.", why: "Optional low-impact conditioning.", swaps: [] },

    // Mobility
    { id: "couch-stretch", name: "Couch Stretch", cat: "mob", unit: "t", rep: [45, 60], perSide: true, cue: "Back knee against the wall, squeeze the glute.", why: "Hip flexor length for deep stances. Part of Seeklander's cooldown.", swaps: [] },
    { id: "ham-stretch", name: "Hamstring Stretch", cat: "mob", unit: "t", rep: [45, 60], perSide: true, cue: "Hinge forward with a flat back.", why: "Hamstring length for low positions.", swaps: [] },
    { id: "box-breath", name: "Box Breathing 4-4-4-4", cat: "mob", unit: "t", rep: [180, 300], cue: "Inhale 4, hold 4, exhale 4, hold 4. Lying face down.", why: "Shifts you into recovery. The same breathing calms you at the start signal.", swaps: [] },
  ];
  const byId = Object.fromEntries(EX.map(e => [e.id, e]));

  // Block: { ex, sets, reps:[lo,hi], rest (s), note, group (superset letter) }
  // Templates keyed by days per week. Each day: name, focus, warm, blocks, finisher
  const WARM = ["bird-dog", "band-pullapart", "lat-lunge"];
  const T = {
    2: [
      { name: "Full Body A", focus: "Strength + power", blocks: [
        { ex: "box-jump", sets: 3, note: "Plyo first while fresh" },
        { ex: "trap-dl", sets: 4 }, { ex: "db-bench", sets: 3, group: "A" }, { ex: "db-row", sets: 3, group: "A" },
        { ex: "bss", sets: 3 }, { ex: "farmer", sets: 3, group: "B" }, { ex: "pallof", sets: 3, group: "B" } ] },
      { name: "Full Body B", focus: "Movement + strength", blocks: [
        { ex: "skater", sets: 3 }, { ex: "decel-drill", sets: 4 },
        { ex: "back-squat", sets: 4 }, { ex: "pullup", sets: 3, group: "A" }, { ex: "ohp", sets: 3, group: "A" },
        { ex: "rdl", sets: 3 }, { ex: "plate-pinch", sets: 3, group: "B" }, { ex: "plank", sets: 2, group: "B" } ] },
    ],
    3: [
      { name: "Day 1 Lower + Stop", focus: "Leg strength and deceleration", blocks: [
        { ex: "skater", sets: 3, note: "Stick every landing for 2 seconds" },
        { ex: "back-squat", sets: 4 }, { ex: "rdl", sets: 3 },
        { ex: "bss", sets: 3 }, { ex: "suitcase", sets: 3, group: "A" }, { ex: "copenhagen", sets: 2, group: "A" } ] },
      { name: "Day 2 Upper + Grip", focus: "Pressing, pulling, crushing grip", blocks: [
        { ex: "mb-chest-pass", sets: 3 },
        { ex: "bench", sets: 4 }, { ex: "pullup", sets: 4 },
        { ex: "landmine-press", sets: 3, group: "A" }, { ex: "chest-row", sets: 3, group: "A" },
        { ex: "face-pull", sets: 2 }, { ex: "rope-pullup", sets: 3, group: "B" }, { ex: "plate-pinch", sets: 3, group: "B" } ] },
      { name: "Day 3 Power + Movement", focus: "Explosiveness, change of direction, core", blocks: [
        { ex: "trap-jump", sets: 4 }, { ex: "shuttle-5105", sets: 4, note: "Full rest between reps. Time each one." },
        { ex: "position-entry", sets: 3 },
        { ex: "trap-dl", sets: 3 }, { ex: "mb-rot-throw", sets: 3 },
        { ex: "farmer", sets: 3, group: "A" }, { ex: "pallof", sets: 3, group: "A" } ],
        finisher: { ex: "bike-int", sets: 6, note: "30 s hard, 60 s easy" } },
    ],
    4: [
      { name: "Day 1 Lower Strength + Stop", focus: "Squat, hinge, landing control", blocks: [
        { ex: "skater", sets: 3, note: "Stick every landing" },
        { ex: "back-squat", sets: 4 }, { ex: "rdl", sets: 3 },
        { ex: "rev-lunge", sets: 3 }, { ex: "calf-raise", sets: 3, group: "A" }, { ex: "copenhagen", sets: 2, group: "A" },
        { ex: "suitcase", sets: 3 } ] },
      { name: "Day 2 Upper Strength + Grip", focus: "Recoil platform: press, pull, grip", blocks: [
        { ex: "plyo-pushup", sets: 3 },
        { ex: "bench", sets: 4 }, { ex: "pullup", sets: 4 },
        { ex: "incline-db", sets: 3, group: "A" }, { ex: "db-row", sets: 3, group: "A" },
        { ex: "face-pull", sets: 2 },
        { ex: "plate-pinch", sets: 3, group: "B" }, { ex: "deadbug", sets: 3, group: "B" } ] },
      { name: "Day 3 Power + Change of Direction", focus: "First step, stopping, positions", blocks: [
        { ex: "position-entry", sets: 3, note: "Skill work while fresh" },
        { ex: "trap-jump", sets: 4 }, { ex: "shuttle-5105", sets: 4, note: "Full rest. Time each rep." },
        { ex: "lat-shuffle", sets: 3 },
        { ex: "trap-dl", sets: 3, note: "Moderate load, fast reps" }, { ex: "lat-lunge", sets: 3 },
        { ex: "mb-rot-throw", sets: 3 } ],
        finisher: { ex: "bike-int", sets: 6, note: "30 s hard, 60 s easy" } },
      { name: "Day 4 Upper Volume + Core + Carries", focus: "Shoulder endurance, trunk, grip", blocks: [
        { ex: "ohp", sets: 3 }, { ex: "lat-pd", sets: 3 },
        { ex: "landmine-press", sets: 3, group: "A" }, { ex: "chest-row", sets: 3, group: "A" },
        { ex: "farmer", sets: 4 }, { ex: "rope-pullup", sets: 3 },
        { ex: "pallof", sets: 3, group: "B" }, { ex: "ab-wheel", sets: 3, group: "B" },
        { ex: "plank", sets: 2 } ] },
    ],
  };
  T[5] = [...T[4], { name: "Day 5 Conditioning + Mobility", focus: "Aerobic base and recovery", blocks: [
    { ex: "zone2", sets: 1, note: "30 to 40 min easy" }, { ex: "sled", sets: 4 },
    { ex: "couch-stretch", sets: 2 }, { ex: "ham-stretch", sets: 2 }, { ex: "box-breath", sets: 1 } ] }];
  const COOLDOWN = ["couch-stretch", "ham-stretch", "box-breath"];

  // Level and age rules applied by the generator
  const LEVELS = {
    beginner: { setsAdj: -1, rir: 3, label: "Beginner", swap: { "back-squat": "goblet-squat", "bench": "db-bench", "trap-dl": "kb-dl", "pullup": "assist-pullup", "ohp": "db-ohp", "rdl": "kb-dl", "trap-jump": "squat-jump", "plyo-pushup": "pushup", "ab-wheel": "deadbug", "rope-pullup": "dead-hang", "copenhagen": "side-plank" } },
    intermediate: { setsAdj: 0, rir: 2, label: "Intermediate", swap: {} },
    advanced: { setsAdj: 1, rir: 1, label: "Advanced", swap: { "back-squat": "back-squat" } },
  };
  const OVER50_SWAP = { "back-squat": "safety-squat", "box-jump": "squat-jump", "plyo-pushup": "mb-chest-pass", "bench": "db-bench", "ohp": "landmine-press" };

  const GOALS = {
    lose: { label: "Lose fat", kcalPct: -0.18, repShift: 0, note: "Keep lifting heavy to hold muscle. Fat comes off in the kitchen." },
    recomp: { label: "Recomp: lose fat, build muscle", kcalPct: -0.05, repShift: 0, note: "Small deficit, high protein, progressive lifting." },
    maintain: { label: "Maintain and perform", kcalPct: 0, repShift: 0, note: "Fuel performance. Focus on getting faster and stronger." },
    gain: { label: "Build muscle and size", kcalPct: 0.10, repShift: 2, note: "Small surplus, more volume, eat consistently every day." },
    strength: { label: "Get stronger and faster", kcalPct: 0.03, repShift: -1, note: "Heavier sets in lower rep ranges plus power work." },
  };

  // Shooting drills. Benchmarks only where the cited page publishes them.
  const DRILLS = [
    { id: "bill-drill", name: "Bill Drill", d: "pistol", dist: "7 yd (also 3 and 5 yd)", target: "USPSA target, A-zone", rounds: 6, start: "Holstered", proc: "On the beep, draw and fire six rounds into the A-zone as fast as you can keep the hits there.", scoring: "time", pen: "Hits outside the A-zone count against you", bm: [{ l: "Goal at 3 yd", t: 1.7 }, { l: "Goal at 5 yd", t: 1.8 }, { l: "Goal at 7 yd", t: 2.0 }], src: "https://benstoeger.com/livefire-drill-bill-drill", srcName: "Ben Stoeger" },
    { id: "el-pres", name: "El Presidente", d: "pistol", dist: "10 yd", target: "3 targets, 1 yd apart", rounds: 12, start: "Back to targets, hands above shoulders, holstered", proc: "Turn, draw, two on each target, reload, two more on each.", scoring: "time", pen: "Fewer than 12 A-zone hits fails the run", bm: [{ l: "Classic standard", t: 10.0 }], src: "https://pistol-training.com/shooting-drills/el-presidente/", srcName: "Pistol-Training.com" },
    { id: "blake", name: "Blake Drill", d: "pistol", dist: "7 yd (up to 15 yd)", target: "3 targets, 1 yd apart, A-zone", rounds: 6, start: "Holstered", proc: "Draw and fire two on each of three targets, transitioning as fast as possible.", scoring: "time", pen: "A-zone hits", bm: [{ l: "Goal at 7 yd", t: 2.0 }], src: "https://www.benstoeger.com/live-fire-drill-blake-drill", srcName: "Ben Stoeger" },
    { id: "four-aces", name: "Four Aces (Double, Reload, Double)", d: "pistol", dist: "3 to 10 yd", target: "USPSA target, A-zone", rounds: 4, start: "Holstered", proc: "Draw, two A-zone hits, reload, two more.", scoring: "time", pen: "A-zone hits", bm: [{ l: "Goal at 3 yd", t: 2.2 }, { l: "Goal at 5 yd", t: 2.3 }, { l: "Goal at 7 yd", t: 2.5 }], src: "https://www.benstoeger.com/livefire-drill-double-reload-double-four-aces", srcName: "Ben Stoeger" },
    { id: "accelerator", name: "The Accelerator", d: "pistol", dist: "Mixed, e.g. 7, 15, 25 yd", target: "3 targets at different distances", rounds: 12, start: "Hands relaxed at sides", proc: "Two on each target, reload, two more on each. Fast on the near target, slower on the far one.", scoring: "time", pen: "Mostly A hits, a couple of Cs acceptable", bm: [{ l: "Goal", t: 6.0 }], src: "https://benstoeger.com/livefire-drill-the-accelerator", srcName: "Ben Stoeger" },
    { id: "fast", name: "F.A.S.T.", d: "pistol", dist: "7 yd", target: "3x5 card (head) and 8 in circle (body)", rounds: 6, start: "Holstered, 2 rounds loaded", proc: "Two on the card, slide-lock reload, four in the circle.", scoring: "time", pen: "Holster adjustments only on the source page", bm: [{ l: "Expert", t: 4.99 }, { l: "Advanced", t: 6.99 }, { l: "Intermediate", t: 9.99 }], src: "https://pistol-training.com/shooting-drills/the-fast/", srcName: "Pistol-Training.com (Todd Green)" },
    { id: "5x5", name: "5x5 Skill Test", d: "pistol", dist: "10 yd", target: "IDPA target", rounds: 25, start: "Hands at sides", proc: "Four strings from the holster: 5 freestyle, 5 strong hand only, 5 + reload + 5, then 4 body and 1 head. Add all four times.", scoring: "time_plus_penalty", penPer: 0.5, penLabel: "Points down", bm: [{ l: "Grand Master", t: 15 }, { l: "Master", t: 20 }, { l: "Expert", t: 25 }, { l: "Sharpshooter", t: 32 }, { l: "Marksman", t: 41 }, { l: "Novice", t: 50 }], src: "https://pistol-training.com/shooting-drills/5x5-skill-test/", srcName: "Pistol-Training.com (Bill Wilson)" },
    { id: "doubles", name: "Doubles", d: "pistol", dist: "5 yd, back 3 yd when you pass", target: "Target with small aiming spot", rounds: 8, start: "Low ready", proc: "Fire pairs with a short pause between pairs. Log your split inside the pair.", scoring: "split", bm: [{ l: "Move back 3 yd", t: 0.20 }], src: "https://athlonoutdoors.com/article/doubles-drill/", srcName: "Athlon Outdoors" },
    { id: "dot-torture", name: "Dot Torture", d: "pistol", dist: "3 yd to start", target: "Dot Torture target, 10 dots", rounds: 50, start: "Holstered for most strings", proc: "Ten dots in order: slow fire, draws, transitions, strong hand, weak hand, reloads.", scoring: "points", max: 50, bm: [{ l: "Clean (then move back)", s: 50 }], src: "https://pistol-training.com/shooting-drills/dot-torture/", srcName: "Pistol-Training.com" },
    { id: "the-test", name: "The Test (10-10-10)", d: "pistol", dist: "10 yd", target: "NRA B-8 repair center", rounds: 10, start: "Low ready", proc: "Ten rounds in ten seconds, scored by ring value out of 100.", scoring: "points", max: 100, bm: [{ l: "Excellent", s: 95 }, { l: "Good", s: 90 }, { l: "Pass", s: 80 }], src: "https://www.everydaymarksman.co/?p=4015133", srcName: "Everyday Marksman" },
    { id: "hack-head", name: "Hackathorn 3-Second Head Shots", d: "pistol", dist: "5 yd", target: "3 targets, 2 ft apart", rounds: 9, start: "Ready, then holstered as skill grows", proc: "Three strings of one head shot per target, each in 3 seconds: left to right, right to left, middle first.", scoring: "points", max: 9, bm: [{ l: "Pass", s: 7 }], src: "https://pistol-training.com/shooting-drills/3-second-head-shot-standards/", srcName: "Pistol-Training.com" },
    { id: "draw", name: "Draw to First Shot", d: "pistol", dist: "About 7 yd", target: "A-zone", rounds: 1, start: "Holstered, random start", proc: "One A-zone hit from the holster. Track the time you make 8 of 10 tries.", scoring: "time", bm: [], src: "https://www.athlonoutdoors.com/article/drawing-from-a-holster/", srcName: "Athlon Outdoors" },
    { id: "easy-exit", name: "Easy Exit (movement)", d: "pistol", dist: "Set your own", target: "2+ targets at A, 1+ at B", rounds: 0, start: "Any", proc: "Shoot position A, start moving on the last shot, engage at position B.", scoring: "time", bm: [], src: "https://www.benstoeger.com/livefire-drill-easy-exit", srcName: "Ben Stoeger" },
    { id: "555-carbine", name: "5-5-5 Carbine Test", d: "rifle", dist: "50 yd", target: "IPSC Classic", rounds: 15, start: "Low ready", proc: "Five standing, reload, five kneeling, reload, five prone.", scoring: "time_plus_penalty", penLabel: "Penalty seconds (C +2, D +5, miss +10)", penPer: 1, bm: [{ l: "Excellent", t: 30 }, { l: "Good", t: 40 }, { l: "Passing", t: 50 }], src: "https://www.everydaymarksman.co/marksmanship/5-5-5-carbine-field-tesst/", srcName: "Everyday Marksman" },
    { id: "rifle-gold", name: "Rifle Standard Gold", d: "rifle", dist: "20, 10, 5 yd", target: "8 in ring", rounds: 15, start: "Ready", proc: "Five at 20 yd, reload, five at 10 yd, reload, five at 5 yd. At least 12 hits in the ring.", scoring: "time", bm: [{ l: "Expert", t: 9.99 }, { l: "Advanced", t: 12.49 }, { l: "Intermediate", t: 14.99 }], src: "https://www.americanrifleman.org/content/skills-check-rifle-standard-gold/", srcName: "American Rifleman (Jeff Gonzales)" },
    { id: "rifle-1-5", name: "1-5 Drill", d: "rifle", dist: "5 yd", target: "3 USPSA targets", rounds: 15, start: "Ready", proc: "1, 2, 3 rounds across targets one to three, then 4 on two and 5 on one. Any non-A fails.", scoring: "time", bm: [{ l: "Master", t: 3.99 }, { l: "Advanced", t: 4.99 }, { l: "Intermediate", t: 5.99 }, { l: "Novice", t: 7.99 }], src: "https://www.rifleconfigurator.com/drills/1-5-drill", srcName: "RifleConfigurator (Kyle Lamb, VTAC)" },
    { id: "load-12", name: "Load 12 (shotgun)", d: "shotgun", dist: "About 10 yd", target: "6 targets", rounds: 14, start: "2 shells in gun", proc: "Shoot one, load four, shoot two, load four, shoot two, load four, shoot one.", scoring: "time", bm: [{ l: "Keith Garcia's demo time (reference)", t: 10.0 }], src: "https://www.outdoorlife.com/articles/guns/2015/12/3-gun-competition-master-load-12-drill/", srcName: "Outdoor Life" },
    { id: "pcc-bill", name: "PCC Bill Drill", d: "pcc", dist: "7 yd", target: "USPSA target, A-zone", rounds: 6, start: "Low ready", proc: "Six A-zone hits from low ready. Personal tracking only.", scoring: "time", bm: [], src: "", srcName: "Track your own progress" },
  ];

  const TAPE = [
    { id: "neck", n: "Neck", how: "Just below the Adam's apple, tape level." },
    { id: "shoulders", n: "Shoulders", how: "Around the widest point of the shoulders, arms relaxed." },
    { id: "chest", n: "Chest", how: "Across the nipples, at the end of a normal breath." },
    { id: "bicepL", n: "Left biceps (flexed)", how: "Peak of the flexed biceps, arm at shoulder height." },
    { id: "bicepR", n: "Right biceps (flexed)", how: "Peak of the flexed biceps, arm at shoulder height." },
    { id: "forearmL", n: "Left forearm", how: "Widest point, fist clenched." },
    { id: "forearmR", n: "Right forearm", how: "Widest point, fist clenched." },
    { id: "waist", n: "Waist (navel)", how: "Level with the belly button, relaxed, end of exhale." },
    { id: "hips", n: "Hips", how: "Widest point of the glutes, feet together." },
    { id: "thighL", n: "Left thigh", how: "Halfway between hip crease and kneecap." },
    { id: "thighR", n: "Right thigh", how: "Halfway between hip crease and kneecap." },
    { id: "calfL", n: "Left calf", how: "Widest point, standing." },
    { id: "calfR", n: "Right calf", how: "Widest point, standing." },
  ];

  const ACTIVITY = {
    light: { f: 1.375, l: "Light: gym 2 to 3 days, desk job" },
    moderate: { f: 1.55, l: "Moderate: gym 3 to 4 days" },
    active: { f: 1.725, l: "Active: gym 4 to 5 days plus an active job or sport" },
    very: { f: 1.9, l: "Very active: hard training most days plus physical work" },
  };

  const SCAN_LABELS = {
    weight_lb: "Weight (lb)", body_fat_pct: "Body fat %", lean_body_mass_lb: "Lean body mass (lb)", skeletal_muscle_mass_lb: "Skeletal muscle (lb)",
    body_fat_mass_lb: "Body fat mass (lb)", subcutaneous_fat_mass_lb: "Subcutaneous fat (lb)", visceral_fat_mass_lb: "Visceral fat mass (lb)", visceral_fat_level: "Visceral fat level",
    visceral_fat_area_cm2: "Visceral fat area (cm2)", protein_lb: "Protein (lb)", mineral_lb: "Mineral (lb)", total_body_water_lb: "Total body water (lb)",
    icf_lb: "Intracellular fluid (lb)", ecf_lb: "Extracellular fluid (lb)", bmr_kcal: "BMR (kcal)", tee_kcal: "TEE (kcal)", bio_age: "Bio age", bwi_score: "BWI score",
    abdominal_circumference_in: "Abdominal circumference (in)", waist_hip_ratio: "Waist to hip ratio",
    left_arm_lean_lb: "Left arm lean", right_arm_lean_lb: "Right arm lean", torso_lean_lb: "Torso lean", left_leg_lean_lb: "Left leg lean", right_leg_lean_lb: "Right leg lean",
    left_arm_fat_lb: "Left arm fat", right_arm_fat_lb: "Right arm fat", torso_fat_lb: "Torso fat", left_leg_fat_lb: "Left leg fat", right_leg_fat_lb: "Right leg fat",
  };
  // lower is better for these
  const LOWER_BETTER = new Set(["body_fat_pct", "body_fat_mass_lb", "subcutaneous_fat_mass_lb", "visceral_fat_mass_lb", "visceral_fat_level", "visceral_fat_area_cm2", "abdominal_circumference_in", "waist_hip_ratio", "bio_age", "left_arm_fat_lb", "right_arm_fat_lb", "torso_fat_lb", "left_leg_fat_lb", "right_leg_fat_lb"]);

  const SOURCES = [
    { t: "Mike Seeklander, \"David\" Fitness Protocol (practical shooting fitness programming)", u: "https://www.shooting-performance.com/effective-practical-shooting-fitness-programming-by-mike-seeklander/", n: "Conditioning first, push/pull and squat/hinge strength, plyometrics, planks, grip via carries and rope pull-ups, dry-fire movement mixed into cardio intervals." },
    { t: "Alexz Jones (USPSA GM), 12-Week Human Performance Shooting Program", u: "https://marketplace.trainheroic.com/workout-plan/program/jones-program-1786843651", n: "Foundation, Capacity, Performance blocks. Single-leg strength, acceleration, footwork, deceleration, grip and trunk." },
    { t: "Shooting Sports USA, Shooting Fitness with Justine Williams (USPSA magazine, Mar/Apr 2025)", u: "https://ssusa.org/content/shooting-fitness-with-justine-williams", n: "A top USPSA competitor credits gym strength work for moving lighter and more explosively." },
    { t: "Shooting Sports USA, Why Strength and Fitness Are Necessary for Competitive Shooters (May/Jun 2025)", u: "https://www.ssusa.org/content/why-is-strength-and-fitness-necessary-for-competitive-shooters", n: "Explosive lower body, core stability, controlled footwork and deceleration; interval training mirrors stages." },
    { t: "Guns in the News, Precision Conditioning for Improved Agility in Action Shooting", u: "https://gunsinthenews.com/precision-conditioning-for-improved-agility-in-action-shooting/", n: "Side lunges, planks, single-leg band work, short intervals with immediate sight pickup." },
    { t: "Modern Warrior Project, Core and Grip Strength", u: "https://modernwarriorproject.com/modern-warrior-conditioning-core-grip-strength-shooting-grappling-carry/", n: "Farmer's walks, towel pull-ups, Pallof presses, ab wheel." },
    { t: "Baye.com, Strength Training for Shooting", u: "https://baye.com/strength-training-for-shooting", n: "Crushing grip matters most for shooting: grippers, thick-bar holds, reverse curls." },
    { t: "ISSN Position Stand: Protein and Exercise (Jager et al., 2017)", u: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8", n: "1.4 to 2.0 g/kg/day for most exercising people; higher intakes may help during a deficit." },
    { t: "Mifflin-St Jeor equation (Mifflin et al., 1990) and Katch-McArdle (lean-mass based) for BMR", u: "https://pubmed.ncbi.nlm.nih.gov/2305711/", n: "Used when no body scan is available. With a scan, lean mass drives the estimate." },
    { t: "Evolt integrations (Bell Potter research note, 2023)", u: "https://bellpotter.com.au/wp-content/uploads/2023/11/Evolt.pdf", n: "Evolt shares data only with enterprise partners by API. Consumers get the Evolt Active app, so this app reads a photo of the printout instead." },
  ];

  return { EX, byId, T, WARM, COOLDOWN, LEVELS, OVER50_SWAP, GOALS, DRILLS, TAPE, ACTIVITY, SCAN_LABELS, LOWER_BETTER, SOURCES };
})();
