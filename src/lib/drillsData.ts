export interface Drill {
  id: string;
  name: string;
  goalMetric: string;
  purpose: string;
  setup: string[];
  steps: string[];
  reps: string;
  focusCues: string[];
  equipment: string[];
}

export const drillsData: Drill[] = [
  {
    id: 'wall-head-check',
    name: 'Wall Head Check',
    goalMetric: 'head_drift_cm',
    purpose: 'Keep your head locked in and reduce head drift for better tracking and consistency.',
    setup: [
      'Stand with your helmet or cap brim about 1 inch from a wall',
      'Take your normal batting stance',
      'Set up a tee if using one'
    ],
    steps: [
      'Get into your stance with cap brim almost touching the wall',
      'Take slow-motion dry swings',
      'Focus on keeping your head still — don\'t let it move forward',
      'Feel the connection between head stability and balance'
    ],
    reps: '3 sets × 8 swings',
    focusCues: [
      'Head stays centered',
      'Eyes track the ball location',
      'No forward drift at contact'
    ],
    equipment: ['Tee', 'Wall']
  },
  {
    id: 'pvc-tilt-ladder',
    name: 'PVC Tilt Ladder',
    goalMetric: 'attack_angle_deg',
    purpose: 'Master your attack angle by training different bat paths to match pitch locations.',
    setup: [
      'Place PVC pipe across your shoulders',
      'Set tee at different heights',
      'Start with a 20–30° forward tilt'
    ],
    steps: [
      'Hold PVC across shoulders in your stance',
      'Tilt forward to match low pitch plane (~20°)',
      'Rehearse swing path following that angle',
      'Adjust tilt for middle and high pitches',
      'Focus on matching bat path to ball location'
    ],
    reps: '3 sets at each angle',
    focusCues: [
      'Match your spine angle to pitch height',
      'Bat follows the tilt angle',
      'Stay in your legs through the zone'
    ],
    equipment: ['PVC pipe', 'Tee']
  },
  {
    id: 'step-behind-sequence',
    name: 'Step-Behind Sequence',
    goalMetric: 'hip_shoulder_sep_deg',
    purpose: 'Build explosive hip-shoulder separation by feeling your hips fire first.',
    setup: [
      'Set up at the tee',
      'Start in normal stance',
      'Prepare for a small step-behind move'
    ],
    steps: [
      'Take a small step behind with your back foot',
      'Load into your back hip',
      'Hold the loaded position for 1 second',
      'Fire your hips open FIRST',
      'Let shoulders follow — feel the separation',
      'Stay balanced through finish'
    ],
    reps: '3 sets × 5 swings',
    focusCues: [
      'Hips lead, shoulders follow',
      'Feel the coil in your core',
      'Finish balanced on front leg'
    ],
    equipment: ['Tee']
  },
  {
    id: 'overunderload-swings',
    name: 'Over/Underload Swings',
    goalMetric: 'bat_lag_deg',
    purpose: 'Train elite bat lag and feel the knob lead your hands through the zone.',
    setup: [
      'Grab 3 bats: one heavy, one game weight, one light',
      'Set tee at contact height',
      'Line them up in order'
    ],
    steps: [
      'Start with heavy bat — 3 controlled swings',
      'Focus on knob leading barrel through the zone',
      'Switch to game bat — 3 aggressive swings',
      'Feel the lag and whip action',
      'Finish with light bat — 3 explosive swings',
      'Maximize bat speed while keeping lag'
    ],
    reps: '3 rounds (heavy, game, light)',
    focusCues: [
      'Knob leads the barrel',
      'Feel the whip at contact',
      'Keep hands inside the ball'
    ],
    equipment: ['Over/underload bats', 'Tee']
  },
  {
    id: 'walk-up-drill',
    name: 'Walk-Up Drill',
    goalMetric: 'exit_velocity_mph',
    purpose: 'Generate max exit velo by building momentum and aggressive energy into contact.',
    setup: [
      'Set tee at contact point',
      'Stand 2-3 steps behind your normal stance spot',
      'Get ready to move forward'
    ],
    steps: [
      'Take 1-2 small walk-up steps toward the tee',
      'Load early as you step',
      'Time your swing to arrive aggressively at contact',
      'Drive through the ball with max intent',
      'Hold your finish to check balance'
    ],
    reps: '3 sets × 6 swings',
    focusCues: [
      'Build momentum into the swing',
      'Load early, swing hard',
      'Stay on balance through contact'
    ],
    equipment: ['Tee']
  },
  {
    id: 'hips-fire-drill',
    name: 'Hips Fire Drill',
    goalMetric: 'hip_rotation_deg',
    purpose: 'Maximize hip rotation by training your hips to lead the swing sequence.',
    setup: [
      'Start in your launch position at the tee',
      'Feet shoulder-width apart',
      'Hands loaded back'
    ],
    steps: [
      'Begin in launch position with hands loaded',
      'Fire your hips open FIRST',
      'Keep hands back as hips rotate',
      'Let hands follow naturally after hips turn',
      'Take it slow — focus on the sequence'
    ],
    reps: '3 sets × 6 swings',
    focusCues: [
      'Hips start everything',
      'Hands stay back until hips open',
      'Feel the power from your core'
    ],
    equipment: ['Tee']
  },
  {
    id: 'shoulder-separation-feel',
    name: 'Shoulder Separation Feel',
    goalMetric: 'hip_shoulder_sep_deg',
    purpose: 'Develop elite separation by isolating hip and shoulder rotation.',
    setup: [
      'Cross arms on your chest',
      'Stand in batting stance',
      'No bat needed for this drill'
    ],
    steps: [
      'Cross arms across your chest',
      'Start in your stance',
      'Rotate hips open toward the pitcher',
      'Keep shoulders back and closed',
      'Feel the stretch in your core',
      'Hold for 1 count, then release',
      'Repeat slowly to feel the coil'
    ],
    reps: '3 sets × 8 reps',
    focusCues: [
      'Hips rotate, shoulders stay back',
      'Feel the stretch in your torso',
      'Control the movement — don\'t rush'
    ],
    equipment: ['None']
  },
  {
    id: 'one-hand-finish',
    name: 'One-Hand Finish',
    goalMetric: 'bat_speed_mph',
    purpose: 'Boost bat speed by training extension and balance through contact.',
    setup: [
      'Set tee at contact height',
      'Grip bat normally',
      'Prepare to release top hand at contact'
    ],
    steps: [
      'Take normal stance at the tee',
      'Start your swing with both hands',
      'Release top hand right at contact',
      'Extend through with bottom hand only',
      'Focus on staying balanced',
      'Hold finish on front leg'
    ],
    reps: '3 sets × 10 swings',
    focusCues: [
      'Full extension through contact',
      'Stay balanced on front leg',
      'Aggressive swing, controlled finish'
    ],
    equipment: ['Tee']
  },
  {
    id: 'back-hip-load-drill',
    name: 'Back Hip Load Drill',
    goalMetric: 'pelvis_tilt_deg',
    purpose: 'Master pelvis tilt by loading into your back hip without drifting backward.',
    setup: [
      'Set up at the tee in stance',
      'Focus on feeling your back hip',
      'No bat needed initially'
    ],
    steps: [
      'Get in your stance',
      'Shift weight into your back hip',
      'Feel pressure on the inside of your back foot',
      'Keep your head centered — don\'t sway back',
      'Hold the loaded position',
      'Now add the swing from that loaded feel'
    ],
    reps: '3 sets × 8 dry swings',
    focusCues: [
      'Load into back hip, not back',
      'Pressure inside back foot',
      'Head stays centered'
    ],
    equipment: ['Tee']
  },
  {
    id: 'separation-pause-drill',
    name: 'Separation Pause Drill',
    goalMetric: 'hip_shoulder_sep_deg',
    purpose: 'Lock in max separation by pausing at the peak coil position.',
    setup: [
      'Set tee at contact height',
      'Start in normal stance',
      'Prepare to pause mid-swing'
    ],
    steps: [
      'Take your normal load',
      'Begin to fire hips',
      'Pause for 1 full count at max separation',
      'Feel your hips open, shoulders still back',
      'Explode through from the pause',
      'Focus on control, not speed'
    ],
    reps: '3 sets × 6 controlled reps',
    focusCues: [
      'Pause at peak separation',
      'Feel the coil in your core',
      'Controlled explosion from the pause'
    ],
    equipment: ['Tee']
  },
  {
    id: 'target-line-check',
    name: 'Target Line Check',
    goalMetric: 'swing_plane_deg',
    purpose: 'Dial in your swing plane by matching your bat path to the target line.',
    setup: [
      'Set alignment stick on the ground toward target',
      'Set tee at contact point',
      'Align your feet and bat path to the stick'
    ],
    steps: [
      'Place alignment stick pointing at your target',
      'Take dry swings',
      'Match your bat path to the stick angle',
      'Check that barrel stays on plane',
      'Adjust setup if bat path drifts off line'
    ],
    reps: '3 sets × 8 swings',
    focusCues: [
      'Bat follows the target line',
      'Stay on plane through the zone',
      'Check alignment after each swing'
    ],
    equipment: ['Tee', 'Alignment stick']
  },
  {
    id: 'balance-hold-drill',
    name: 'Balance Hold Drill',
    goalMetric: 'head_drift_cm',
    purpose: 'Eliminate head drift by training balance and stability through the finish.',
    setup: [
      'Set tee at contact height',
      'Start in stance',
      'Prepare to hold your finish'
    ],
    steps: [
      'Take your swing off the tee',
      'At finish, freeze on your front leg',
      'Hold for 2 full seconds',
      'Check that your head stayed centered',
      'If you fall off balance, reset and try again'
    ],
    reps: '3 sets × 5 swings',
    focusCues: [
      'Head stays quiet',
      'Finish balanced on front leg',
      'Hold for 2 seconds every time'
    ],
    equipment: ['Tee']
  },
  {
    id: 'bat-lag-trainer',
    name: 'Bat Lag Trainer',
    goalMetric: 'bat_lag_deg',
    purpose: 'Feel elite bat lag by slowing down and focusing on knob-first mechanics.',
    setup: [
      'Set tee at contact height',
      'Start in normal stance',
      'Focus on slow-motion reps'
    ],
    steps: [
      'Take slow-motion swings',
      'Feel the knob of the bat lead your hands',
      'Barrel stays back behind your hands',
      'As you reach contact, release the barrel',
      'Feel the whip action through the zone'
    ],
    reps: '3 sets × 8 swings',
    focusCues: [
      'Knob leads, barrel follows',
      'Feel the lag before the whip',
      'Slow it down to learn the feel'
    ],
    equipment: ['Tee']
  },
  {
    id: 'launch-position-check',
    name: 'Launch Position Check',
    goalMetric: 'shoulder_angle_deg',
    purpose: 'Optimize shoulder angle by checking your posture in the launch position.',
    setup: [
      'Set tee at contact height',
      'Get bat to shoulder height',
      'Check posture in a mirror or with video'
    ],
    steps: [
      'Set bat at shoulder height',
      'Check your spine tilt — slight forward lean',
      'Make sure shoulders are level or slightly tilted',
      'Hold the position and feel it',
      'Now swing from that dialed-in launch position'
    ],
    reps: '3 sets × 8 reps',
    focusCues: [
      'Bat at shoulder height',
      'Spine tilted slightly forward',
      'Shoulders level or slightly angled'
    ],
    equipment: ['Tee']
  },
  {
    id: 'posture-stick-drill',
    name: 'Posture Stick Drill',
    goalMetric: 'shoulder_angle_deg',
    purpose: 'Lock in proper posture and shoulder angles with a stick along your spine.',
    setup: [
      'Place PVC or bat along your spine',
      'Get into stance',
      'Feel the stick touch your head, back, and hips'
    ],
    steps: [
      'Hold PVC or bat along your spine',
      'Get into batting stance',
      'Rehearse your hinge and posture',
      'Keep stick touching head, back, and hips',
      'Feel the correct angles',
      'Remove stick and replicate the feel'
    ],
    reps: '3 sets × 6 reps',
    focusCues: [
      'Stick stays on head, back, hips',
      'Feel the proper hinge angle',
      'Replicate without the stick'
    ],
    equipment: ['PVC pipe or bat']
  },
  {
    id: 'contact-point-drill',
    name: 'Contact Point Drill',
    goalMetric: 'extension_cm',
    purpose: 'Maximize extension by training contact slightly ahead of your front foot.',
    setup: [
      'Place ball on tee slightly ahead of front foot',
      'Adjust so you have to reach forward',
      'Get in stance'
    ],
    steps: [
      'Set ball ahead of your front foot',
      'Take your swing',
      'Reach forward to meet the ball square',
      'Feel full extension through contact',
      'Hold finish to check balance'
    ],
    reps: '3 sets × 8 reps',
    focusCues: [
      'Contact out front',
      'Full extension through the ball',
      'Finish balanced'
    ],
    equipment: ['Tee', 'Ball']
  },
  {
    id: 'k-vest-tempo-reps',
    name: 'K-Vest Tempo Reps',
    goalMetric: 'time_to_contact_ms',
    purpose: 'Dial in timing and sequence consistency using K-Vest or similar tech.',
    setup: [
      'Put on K-Vest or similar device',
      'Set tee at contact height',
      'Check timing display'
    ],
    steps: [
      'Wear K-Vest or timing device',
      'Take your swing and check timing metrics',
      'Focus on keeping the same sequence every swing',
      'Adjust tempo if timing drifts',
      'Repeat until timing is consistent'
    ],
    reps: '3 sets × 5 swings',
    focusCues: [
      'Match timing every swing',
      'Stay smooth and repeatable',
      'Use the data to dial it in'
    ],
    equipment: ['K-Vest or timing device']
  },
  {
    id: 'line-drive-ladder',
    name: 'Line Drive Ladder',
    goalMetric: 'launch_angle_deg',
    purpose: 'Master launch angle control by hitting line drives at specific angles.',
    setup: [
      'Set tee at contact height',
      'Set up net or target',
      'Prepare to adjust attack angle'
    ],
    steps: [
      'Start with 10° launch angle — low line drive',
      'Hit 3 swings at that angle',
      'Adjust to 15° — mid line drive',
      'Hit 3 more swings',
      'Move up to 20°, then 25°',
      'Feel how small changes in attack angle affect launch'
    ],
    reps: '3 swings per angle (10°, 15°, 20°, 25°)',
    focusCues: [
      'Slight adjustments = big changes',
      'Match bat path to target launch angle',
      'Stay aggressive through contact'
    ],
    equipment: ['Tee', 'Net']
  },
  {
    id: 'pvc-turn-drill',
    name: 'PVC Turn Drill',
    goalMetric: 'hip_rotation_deg',
    purpose: 'Maximize hip rotation by isolating the turn without lunging forward.',
    setup: [
      'Hold PVC pipe across your chest',
      'Get in batting stance',
      'Focus on rotating, not lunging'
    ],
    steps: [
      'Hold PVC across chest',
      'Start in stance',
      'Rotate hips open toward pitcher',
      'Keep weight centered — don\'t lunge forward',
      'Feel full hip rotation',
      'Return to start and repeat'
    ],
    reps: '3 sets × 8 rotations',
    focusCues: [
      'Full hip turn',
      'No forward lunge',
      'Weight stays centered'
    ],
    equipment: ['PVC pipe']
  },
  {
    id: 'head-still-tee-drill',
    name: 'Head Still Tee Drill',
    goalMetric: 'head_drift_cm',
    purpose: 'Lock in zero head drift by filming and checking your head position at contact.',
    setup: [
      'Set tee at contact height',
      'Set up phone or camera to film from side',
      'Get in stance'
    ],
    steps: [
      'Set up camera to film from the side',
      'Take swings off the tee',
      'Keep your head centered through contact',
      'Watch video after each set',
      'Check that head stayed still — adjust if needed'
    ],
    reps: '3 sets × 8 swings',
    focusCues: [
      'Head locked in',
      'Eyes on contact point',
      'Use video to check yourself'
    ],
    equipment: ['Tee', 'Camera/phone']
  }
];
