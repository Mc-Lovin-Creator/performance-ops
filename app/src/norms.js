/* ---------- verified norms (v30) ----------
   Every number below is traced to a peer-reviewed source. Where no valid tiered norm
   exists, the metric is graded I (individual): it is tracked against the athlete's own
   baseline, never against an invented band. */
const PM = q => 'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(q);
const SRC = {
  mckay: { cite: 'McKay AKA et al. Defining training and performance caliber: a participant classification framework. Int J Sports Physiol Perform 2022;17(2):317-331', url: 'https://doi.org/10.1123/ijspp.2021-0451' },
  friend: { cite: 'Kaminsky LA, Arena R, Myers J. Reference standards for cardiorespiratory fitness measured with CPET (FRIEND registry). Mayo Clin Proc 2015;90(11):1515-1523', url: 'https://doi.org/10.1016/j.mayocp.2015.07.026' },
  pradas: { cite: 'Pradas F et al. Physical fitness in professional padel: differences by gender and playing side (top-50 World Padel Tour, 15 men, 15 women). Biol Sport 2025;42(4):231-239', url: 'https://doi.org/10.5114/biolsport.2025.151647' },
  gonz: { cite: 'González-Jiménez A et al. Playing side and weekly training frequency in elite padel players (14 men, regional top-10, pro circuits). J Funct Morphol Kinesiol 2026;11(1):111', url: 'https://doi.org/10.3390/jfmk11010111' },
  sanchez: { cite: 'Sánchez-Muñoz C et al. Anthropometric and physical fitness profiles of world-class male padel players. Int J Environ Res Public Health 2020;17(2):508', url: 'https://doi.org/10.3390/ijerph17020508' },
  mellado: { cite: 'Mellado-Arbelo O, Baiget Vidal E. Activity profile and physiological demand of padel match play: a systematic review. Kinesiology 2022;54(1):51-61', url: 'https://ojs.srce.hr/kinesiology/article/view/9871' },
  dodds: { cite: 'Dodds RM et al. Grip strength across the life course: normative data from twelve British studies (n = 49,964). PLoS One 2014;9(12):e113637', url: 'https://pubmed.ncbi.nlm.nih.gov/25474696/' },
  ewgsop: { cite: 'Cruz-Jentoft AJ et al. Sarcopenia: revised European consensus (EWGSOP2). Age Ageing 2019;48(1):16-31', url: PM('Cruz-Jentoft 2019 sarcopenia revised European consensus') },
  cole: { cite: 'Cole CR et al. Heart-rate recovery immediately after exercise as a predictor of mortality (n = 2,428). N Engl J Med 1999;341(18):1351-1357', url: 'https://pubmed.ncbi.nlm.nih.gov/10536127/' },
  bohannon: { cite: 'Bohannon RW, Williams Andrews A. Normal walking speed: a descriptive meta-analysis. Physiotherapy 2011;97(3):182-189', url: PM('Bohannon Andrews 2011 normal walking speed descriptive meta-analysis') },
  grindem: { cite: 'Grindem H et al. Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction. Br J Sports Med 2016;50(13):804-808', url: PM('Grindem 2016 simple decision rules reinjury ACL Delaware-Oslo') },
  bishop: { cite: 'Bishop C, Turner A, Read P. Effects of inter-limb asymmetries on physical and sports performance: a systematic review. J Sports Sci 2018;36(10):1135-1144', url: PM('Bishop Turner Read 2018 inter-limb asymmetries systematic review') },
  hopkins: { cite: 'Hopkins WG. Measures of reliability in sports medicine and science. Sports Med 2000;30(1):1-15', url: 'https://pubmed.ncbi.nlm.nih.gov/10907753/' },
  powden: { cite: 'Powden CJ, Hoch JM, Hoch MC. Reliability and minimal detectable change of the weight-bearing lunge test: a systematic review. Man Ther 2015;20(4):524-532', url: PM('Powden Hoch 2015 weight-bearing lunge test reliability minimal detectable change') },
  nih: { cite: 'Weintraub S et al. Cognition assessment using the NIH Toolbox. Neurology 2013;80(11 Suppl 3):S54-S64', url: PM('Weintraub 2013 cognition assessment NIH Toolbox Neurology') },
  garber: { cite: 'Garber CE et al. ACSM position stand: quantity and quality of exercise for developing and maintaining fitness. Med Sci Sports Exerc 2011;43(7):1334-1359', url: 'https://pubmed.ncbi.nlm.nih.gov/21694556/' },
  currier: { cite: 'Currier BS et al. ACSM position stand: resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults. Med Sci Sports Exerc 2026;58(3):512-545 (replaces the 2009 stand)', url: PM('Currier 2026 American College of Sports Medicine position stand resistance training prescription') },
  nsca19: { cite: 'Caterisano A et al. CSCCa and NSCA joint consensus guidelines for transition periods: safe return to training following inactivity. Strength Cond J 2019;41(3):1-23', url: 'https://www.nsca.com/about-us/position-statements/safe-return-to-training/' },
  ncaa19: { cite: 'NCAA Sport Science Institute. Interassociation recommendations: preventing catastrophic injury and death in collegiate athletes (endorsed by 13 medical organisations), 2019', url: 'https://ncaaorg.s3.amazonaws.com/ssi/injury_prev/SSI_PreventingCatastrophicInjuryBooklet.pdf' },
  casa12: { cite: 'Casa DJ et al. The Inter-Association Task Force for preventing sudden death in collegiate conditioning sessions: best practices recommendations. J Athl Train 2012;47(4):477-480', url: 'https://doi.org/10.4085/1062-6050-47.4.08' },
  tanaka: { cite: 'Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol 2001;37(1):153-156', url: PM('Tanaka Monahan Seals 2001 age-predicted maximal heart rate revisited') },
  beyer: { cite: 'Beyer R et al. Heavy slow resistance versus eccentric training as treatment for Achilles tendinopathy: a randomized controlled trial. Am J Sports Med 2015;43(7):1704-1711', url: PM('Beyer 2015 heavy slow resistance eccentric Achilles tendinopathy randomized') },
  coombes: { cite: 'Coombes BK, Bisset L, Vicenzino B. Management of lateral elbow tendinopathy: one size does not fit all. J Orthop Sports Phys Ther 2015;45(11):938-949', url: PM('Coombes Bisset Vicenzino 2015 management lateral elbow tendinopathy') },
  kongsgaard: { cite: 'Kongsgaard M et al. Corticosteroid injections, eccentric decline squat training and heavy slow resistance training in patellar tendinopathy. Scand J Med Sci Sports 2009;19(6):790-802', url: PM('Kongsgaard 2009 heavy slow resistance patellar tendinopathy') },
  docking: { cite: 'Docking SI, Cook J. Pathological tendons maintain sufficient aligned fibrillar structure on ultrasound tissue characterization (UTC). Scand J Med Sci Sports 2016;26(6):675-683', url: PM('Docking Cook 2016 pathological tendons maintain sufficient aligned fibrillar structure') },
  cook09: { cite: 'Cook JL, Purdam CR. Is tendon pathology a continuum? A pathology model to explain the clinical presentation of load-induced tendinopathy. Br J Sports Med 2009;43(6):409-416', url: PM('Cook Purdam 2009 tendon pathology continuum') },
  pedersen: { cite: 'Pedersen BK, Febbraio MA. Muscles, exercise and obesity: skeletal muscle as a secretory organ. Nat Rev Endocrinol 2012;8(8):457-465', url: PM('Pedersen Febbraio 2012 skeletal muscle as a secretory organ') },
  neumann: { cite: 'Neumann DA. Kinesiology of the Musculoskeletal System, 3rd ed. Elsevier 2017 (muscle roles: agonist, antagonist, synergist, stabiliser)', url: 'https://www.google.com/search?q=Neumann+Kinesiology+of+the+Musculoskeletal+System+3rd+edition' },
  escamilla01: { cite: 'Escamilla RF. Knee biomechanics of the dynamic squat exercise. Med Sci Sports Exerc 2001;33(1):127-141', url: PM('Escamilla 2001 knee biomechanics of the dynamic squat exercise') },
  escamilla09: { cite: 'Escamilla RF, Andrews JR. Shoulder muscle recruitment patterns and related biomechanics during upper extremity sports. Sports Med 2009;39(7):569-590', url: PM('Escamilla Andrews 2009 shoulder muscle recruitment upper extremity sports') },
  hebert: { cite: 'Hébert-Losier K, Newsham-West RJ, Schneiders AG, Sullivan SJ. Raising the standards of the calf-raise test: a systematic review. J Sci Med Sport 2009;12(6):594-602', url: PM('Hebert-Losier 2009 raising the standards of the calf-raise test systematic review') },
  hamilton22: { cite: 'Hamilton MT et al. A potent physiological method to magnify and sustain soleus oxidative metabolism improves glucose and lipid regulation. iScience 2022;25(9):104869', url: PM('Hamilton 2022 soleus oxidative metabolism glucose iScience') },
  szuhany: { cite: 'Szuhany KL, Bugatti M, Otto MW. A meta-analytic review of the effects of exercise on brain-derived neurotrophic factor. J Psychiatr Res 2015;60:56-64', url: PM('Szuhany 2015 meta-analytic review exercise brain-derived neurotrophic factor') },
  kannus91: { cite: 'Kannus P, Józsa L. Histopathological changes preceding spontaneous rupture of a tendon. J Bone Joint Surg Am 1991;73(10):1507-1525', url: PM('Kannus Jozsa 1991 histopathological changes preceding spontaneous rupture tendon') },
  mckeon15: { cite: 'McKeon PO, Hertel J, Bramble D, Davis I. The foot core system: a new paradigm for understanding intrinsic foot muscle function. Br J Sports Med 2015;49(5):290', url: PM('McKeon 2015 foot core system paradigm intrinsic foot muscle') },
  rampinini: { cite: 'Ramirez-Campillo R et al. Effects of plyometric jump training on physical fitness in team sport athletes: a systematic review with meta-analysis (and related meta-analyses). Sports Med 2020', url: PM('Ramirez-Campillo plyometric jump training meta-analysis team sport') },
  rio: { cite: 'Rio E et al. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. Br J Sports Med 2015;49(19):1277-1283', url: PM('Rio 2015 isometric exercise induces analgesia patellar tendinopathy') },
  vuurberg: { cite: 'Vuurberg G et al. Diagnosis, treatment and prevention of ankle sprains: an evidence-based clinical guideline. Br J Sports Med 2018;52(15):956', url: PM('Vuurberg 2018 ankle sprains evidence-based clinical guideline') },
  mujika: { cite: 'Mujika I, Padilla S. Detraining: loss of training-induced physiological and performance adaptations. Sports Med 2000;30(2):79-87 and 30(3):145-154', url: PM('Mujika Padilla 2000 detraining loss of training-induced adaptations') },
  halson: { cite: 'Halson SL. Monitoring training load to understand fatigue in athletes. Sports Med 2014;44(Suppl 2):S139-S147', url: PM('Halson 2014 monitoring training load to understand fatigue in athletes') },
  gabbett: { cite: 'Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med 2016;50(5):273-280', url: PM('Gabbett 2016 training-injury prevention paradox') },
  seiler: { cite: 'Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform 2010;5(3):276-291', url: PM('Seiler 2010 best practice training intensity duration distribution endurance athletes') },
  acsm09: { cite: 'ACSM position stand: progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687-708', url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/' },
  riebe: { cite: 'Riebe D et al. Updating ACSM recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 2015;47(11):2473-2479', url: 'https://pubmed.ncbi.nlm.nih.gov/26473759/' },
  who: { cite: 'Bull FC et al. WHO 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med 2020;54(24):1451-1462', url: PM('Bull 2020 World Health Organization guidelines physical activity sedentary behaviour') },
  bosquet: { cite: 'Bosquet L et al. Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc 2007;39(8):1358-1365', url: 'https://pubmed.ncbi.nlm.nih.gov/17596787/' },
  pareja: { cite: 'Pareja-Blanco F et al. Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations. Scand J Med Sci Sports 2017;27(7):724-735', url: PM('Pareja-Blanco 2017 velocity loss resistance training athletic performance') },
  issurin: { cite: 'Issurin VB. New horizons for the methodology and physiology of training periodization. Sports Med 2010;40(3):189-206', url: PM('Issurin 2010 new horizons methodology physiology training periodization') },
  bourdon: { cite: 'Bourdon PC et al. Monitoring athlete training loads: consensus statement. Int J Sports Physiol Perform 2017;12(Suppl 2):S2161-S2170', url: 'https://pubmed.ncbi.nlm.nih.gov/28463642/' },
  impel: { cite: 'Impellizzeri FM et al. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 2020;15(6):907-913', url: PM('Impellizzeri 2020 acute chronic workload ratio conceptual issues fundamental pitfalls') }
};
const GRADES = {
  A: ['A', 'Large registry or meta-analysis', 'Thousands of people, measured with a standard protocol. Strongest reference available.'],
  B: ['B', 'Peer-reviewed professional padel cohort', 'Real pro players, but small samples (about 15 per sex). Good for context, not a hard cut-off.'],
  C: ['C', 'Single small study or estimated value', 'Use as a rough guide only; device and protocol differences change the number.'],
  I: ['I', 'No valid tiered norm exists', 'Tracked against his own baseline. A change counts when it is bigger than the test\'s typical error (Hopkins 2000).']
};
/* the four app populations mapped onto McKay 2022 tiers */
const POP_FRAME = [
  { id: 'sedentary', label: 'Sedentary', tier: 'Tier 0', def: 'Does not meet WHO activity guidelines (150 to 300 min moderate, or 75 to 150 min vigorous, a week).', src: ['mckay', 'who'] },
  { id: 'trained', label: 'Trained', tier: 'Tiers 1 to 2', def: 'Recreationally active to trained: meets the guidelines; trains about three times a week with a sport focus, may compete locally.', src: ['mckay'] },
  { id: 'competitive', label: 'Competitive', tier: 'Tier 3', def: 'Highly trained, national level: structured training most days, competes nationally.', src: ['mckay'] },
  { id: 'elite', label: 'Elite', tier: 'Tiers 4 to 5', def: 'Elite international to world class. In padel: ranked on the Premier Padel (formerly World Padel Tour) circuit.', src: ['mckay'] }
];
const SOURCE_ROLES = [
  ['McKay et al. 2022 (IJSPP)', 'Defines who counts as sedentary, trained, competitive and elite. The most widely adopted classification in sport science; ACSM does not define an elite tier.'],
  ['ACSM', 'Pre-participation screening (Riebe 2015) and FITT-VP prescription (Garber 2011; resistance progression 2009). Built for the general and trained population, so it anchors the sedentary and trained tiers.'],
  ['FRIEND registry, Dodds 2014, Bohannon 2011', 'Large population norms by sex and age: VO₂max, grip strength, walking speed.'],
  ['Professional padel cohorts', 'Pradas 2025 (top-50 World Padel Tour men and women), Sánchez-Muñoz 2020 (world-class men), González-Jiménez 2026 (elite men). These set the elite and competitive references for padel.'],
  ['NCAA', 'A governing body for US college sport. It publishes no physiological norms, so it is not used as a source.']
];
/* refs: tier = clinical | sedentary | trained | population | competitive | elite ; k = range | mean | cut */
const NORMS = [
  { id: 'vo2', metric: 'VO₂max', unit: 'mL/kg/min', domain: 'Cardiovascular', grade: 'A', protocol: 'Treadmill CPET, measured gas exchange', note: 'Age matters: the pro padel cohorts are mostly in their twenties and thirties, so for a player over 40 the age-matched FRIEND band is the fairer comparison, and matching the pro means is a strong result. Padel elites sit inside the trained general-population range: aerobic capacity is not what separates pros in padel (Mellado-Arbelo 2022). Repeated high-intensity ability matters more.', src: ['friend', 'pradas', 'gonz', 'mellado', 'mckay'],
    refs: [
      { sex: 'm', age: '20-29', tier: 'sedentary', k: 'range', r: [32.1, 40.1], label: 'General population 10th to 25th percentile', s: 'friend' },
      { sex: 'm', age: '20-29', tier: 'trained', k: 'range', r: [48.0, 61.8], label: 'General population 50th to 90th percentile', s: 'friend' },
      { sex: 'm', age: '30-39', tier: 'sedentary', k: 'range', r: [30.2, 35.9], label: 'General population 10th to 25th percentile', s: 'friend' },
      { sex: 'm', age: '30-39', tier: 'trained', k: 'range', r: [42.4, 56.5], label: 'General population 50th to 90th percentile', s: 'friend' },
      { sex: 'm', age: '40-49', tier: 'sedentary', k: 'range', r: [26.8, 31.9], label: 'General population 10th to 25th percentile, men 40 to 49', s: 'friend' },
      { sex: 'm', age: '40-49', tier: 'trained', k: 'range', r: [37.8, 52.1], label: 'General population 50th to 90th percentile, men 40 to 49', s: 'friend' },
      { sex: 'f', age: '40-49', tier: 'sedentary', k: 'range', r: [18.8, 22.1], label: 'General population 10th to 25th percentile, women 40 to 49', s: 'friend' },
      { sex: 'f', age: '40-49', tier: 'trained', k: 'range', r: [26.7, 38.4], label: 'General population 50th to 90th percentile, women 40 to 49', s: 'friend' },
      { sex: 'f', age: '20-29', tier: 'sedentary', k: 'range', r: [23.9, 30.5], label: 'General population 10th to 25th percentile', s: 'friend' },
      { sex: 'f', age: '20-29', tier: 'trained', k: 'range', r: [37.6, 51.3], label: 'General population 50th to 90th percentile', s: 'friend' },
      { sex: 'f', age: '30-39', tier: 'sedentary', k: 'range', r: [20.9, 25.3], label: 'General population 10th to 25th percentile', s: 'friend' },
      { sex: 'f', age: '30-39', tier: 'trained', k: 'range', r: [30.2, 41.4], label: 'General population 50th to 90th percentile', s: 'friend' },
      { sex: 'm', tier: 'competitive', k: 'mean', v: 50.8, label: 'Elite regional padel men, estimated from Yo-Yo IR2 (grade C)', s: 'gonz' },
      { sex: 'm', tier: 'elite', k: 'range', r: [54.2, 56.9], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [45.5, 48.1], label: 'Top-50 WPT women, group means by side', s: 'pradas' }] },
  { id: 'hrr', metric: 'Heart-rate recovery, 1 min', unit: 'bpm', domain: 'Cardiovascular', grade: 'A', protocol: 'Drop in HR one minute after peak, walking cool-down (Cole 1999 protocol)', note: 'A clinical safety threshold, not a performance norm. No validated athlete tiers exist; track his own trend.', src: ['cole', 'hopkins'],
    refs: [{ tier: 'clinical', k: 'cut', v: 12, okIf: 'gt', label: '12 bpm or less is abnormal (raised mortality risk)', s: 'cole' }] },
  { id: 'vt', metric: 'VT1 and VT2', unit: 'mL/kg/min and % VO₂max', domain: 'Cardiovascular', grade: 'I', protocol: 'From the same CPET', note: 'Used to set his individual training zones. No valid population tiers exist, so none are shown.', src: ['hopkins'], refs: [] },
  { id: 'grip', metric: 'Handgrip, dominant hand', unit: 'kg', domain: 'Strength', grade: 'A', protocol: 'Hand dynamometer, best of trials', note: 'Pro padel men grip about the same as the general-population peak. Use it for health and side-to-side checks, not to rank elite level.', src: ['dodds', 'ewgsop', 'pradas', 'gonz'],
    refs: [
      { sex: 'm', tier: 'clinical', k: 'cut', v: 27, label: 'Below 27 kg = low strength', s: 'ewgsop' },
      { sex: 'f', tier: 'clinical', k: 'cut', v: 16, label: 'Below 16 kg = low strength', s: 'ewgsop' },
      { sex: 'm', tier: 'population', k: 'mean', v: 51, label: 'General population peak median, age 29 to 39', s: 'dodds' },
      { sex: 'f', tier: 'population', k: 'mean', v: 31, label: 'General population peak median, age 26 to 42', s: 'dodds' },
      { sex: 'm', tier: 'competitive', k: 'mean', v: 49.1, label: 'Elite regional padel men', s: 'gonz' },
      { sex: 'm', tier: 'elite', k: 'range', r: [50.6, 51.8], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [31.6, 35.4], label: 'Top-50 WPT women, group means by side', s: 'pradas' }] },
  { id: 'cmj', metric: 'Countermovement jump height', unit: 'cm', domain: 'Strength', grade: 'C', protocol: 'Hands on hips; device must match the study (mat, plates or optical)', note: 'The two padel studies disagree (regional men jumped higher than top-50 pros), almost certainly because of different devices. Compare him with himself first.', src: ['pradas', 'gonz', 'hopkins'],
    refs: [
      { sex: 'm', tier: 'competitive', k: 'mean', v: 41.0, label: 'Elite regional padel men', s: 'gonz' },
      { sex: 'm', tier: 'elite', k: 'range', r: [28.7, 37.1], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [24.0, 24.6], label: 'Top-50 WPT women, group means by side', s: 'pradas' }] },
  { id: 'squat', metric: 'Back squat 1RM', unit: 'kg', domain: 'Strength', grade: 'C', protocol: 'Direct 1RM', note: 'Large spread in the study (SD up to 80 kg). Relative to body mass is more useful; record body mass with it.', src: ['pradas'],
    refs: [
      { sex: 'm', tier: 'elite', k: 'range', r: [148.8, 205.8], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [125.1, 145.6], label: 'Top-50 WPT women, group means by side', s: 'pradas' }] },
  { id: 'imtp', metric: 'IMTP peak force', unit: 'N/kg', domain: 'Strength', grade: 'I', protocol: 'Isometric mid-thigh pull on force plates', note: 'No padel or elite racket-sport norm has been published that we could verify. Track against his baseline.', src: ['hopkins'], refs: [] },
  { id: 'rsi', metric: 'Reactive strength index, drop jump', unit: 'm/s', domain: 'Strength', grade: 'I', protocol: 'Drop jump, fixed box height', note: 'Values depend on box height and device; no validated population tiers. Track against his baseline.', src: ['hopkins'], refs: [] },
  { id: 'lsi', metric: 'Limb symmetry index', unit: '%', domain: 'Strength', grade: 'B', protocol: 'Hop tests or isokinetic strength, injured vs uninjured side', note: 'The 90% rule comes from ACL return-to-sport research; applying it to other injuries is common practice but extrapolated.', src: ['grindem', 'bishop'],
    refs: [{ tier: 'clinical', k: 'cut', v: 90, up: true, label: '90% or more before return to sport', s: 'grindem' }] },
  { id: 'shuttle', metric: '10 × 5 m shuttle', unit: 's', lower: true, domain: 'Speed and agility', grade: 'B', protocol: 'Ten 5 m shuttles, timing gates', note: '', src: ['pradas'],
    refs: [
      { sex: 'm', tier: 'elite', k: 'range', r: [15.7, 16.6], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [17.6, 17.6], label: 'Top-50 WPT women', s: 'pradas' }] },
  { id: 'ttest', metric: 'Agility T-test', unit: 's', lower: true, domain: 'Speed and agility', grade: 'C', protocol: 'Standard T-test, timing gates', note: '', src: ['gonz'],
    refs: [{ sex: 'm', tier: 'competitive', k: 'mean', v: 10.4, label: 'Elite regional padel men', s: 'gonz' }] },
  { id: 'yoyo', metric: 'Yo-Yo intermittent recovery level 2', unit: 'm', domain: 'Speed and agility', grade: 'C', protocol: 'Yo-Yo IR2', note: 'Closer to padel demands than VO₂max: repeated high-intensity efforts.', src: ['gonz', 'mellado'],
    refs: [{ sex: 'm', tier: 'competitive', k: 'mean', v: 404, label: 'Elite regional padel men', s: 'gonz' }] },
  { id: 'react', metric: 'Choice reaction time', unit: 's', lower: true, domain: 'Cognitive', grade: 'C', protocol: 'Device-specific; only comparable with the same system', note: 'Reaction component only, from one study using one device.', src: ['pradas'],
    refs: [
      { sex: 'm', tier: 'elite', k: 'range', r: [0.68, 0.81], label: 'Top-50 WPT men, group means', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [0.57, 0.68], label: 'Top-50 WPT women, group means', s: 'pradas' }] },
  { id: 'proc', metric: 'Processing speed (NIH Toolbox)', unit: 'age-corrected standard score', domain: 'Cognitive', grade: 'A', protocol: 'NIH Toolbox Pattern Comparison', note: 'Scored with a mean of 100 and SD of 15 for his age. The old app showed 38 to 95, which was the wrong scale.', src: ['nih'],
    refs: [{ tier: 'clinical', k: 'cut', v: 85, up: true, label: 'Below 85 = more than 1 SD under his age norm', s: 'nih' }, { tier: 'population', k: 'mean', v: 100, label: 'Age-group average', s: 'nih' }] },
  { id: 'dual', metric: 'Dual-task cost and D2 reaction', unit: '%, ms', domain: 'Cognitive', grade: 'I', protocol: 'Same task and device each time', note: 'No validated athlete tiers. Track against his baseline.', src: ['hopkins'], refs: [] },
  { id: 'wblt', metric: 'Ankle dorsiflexion, weight-bearing lunge', unit: 'cm or °, each side', domain: 'Movement', grade: 'I', protocol: 'Knee-to-wall lunge, same tester', note: 'Key for his foot. Judge change against the test\'s minimal detectable change and compare sides; population cut-offs vary too much between studies to rank him.', src: ['powden', 'hopkins'], refs: [] },
  { id: 'sitreach', metric: 'Sit-and-reach', unit: 'cm', domain: 'Movement', grade: 'B', protocol: 'Standard box', note: '', src: ['pradas'],
    refs: [
      { sex: 'm', tier: 'elite', k: 'range', r: [27.3, 29.1], label: 'Top-50 WPT men, group means by side', s: 'pradas' },
      { sex: 'f', tier: 'elite', k: 'range', r: [32.5, 36.2], label: 'Top-50 WPT women, group means by side', s: 'pradas' }] },
  { id: 'gait', metric: 'Walking speed, comfortable', unit: 'm/s', domain: 'Movement', grade: 'A', protocol: 'Timed walk at comfortable pace', note: 'A health marker, not an athletic one. No athlete tiers. Age bands above 39 not yet loaded.', src: ['bohannon'],
    refs: [
      { sex: 'm', age: '20-29', tier: 'population', k: 'mean', v: 1.36, label: 'Average for men 20 to 29', s: 'bohannon' },
      { sex: 'm', age: '30-39', tier: 'population', k: 'mean', v: 1.43, label: 'Average for men 30 to 39', s: 'bohannon' },
      { sex: 'f', age: '20-29', tier: 'population', k: 'mean', v: 1.34, label: 'Average for women 20 to 29', s: 'bohannon' },
      { sex: 'f', age: '30-39', tier: 'population', k: 'mean', v: 1.34, label: 'Average for women 30 to 39', s: 'bohannon' }] },
  { id: 'move', metric: 'SPARC smoothness, cadence, gait loading asymmetry', unit: 'various', domain: 'Movement', grade: 'I', protocol: 'Same sensor and route', note: 'The previous elite bands for these were not supported by any study. Removed; track against his baseline.', src: ['bishop', 'hopkins'], refs: [] }
];
/* prescription: each line tagged as evidence (with source) or team practice */
const RXP = {
  sedentary: [['Screening', 'ACSM pre-participation screening before starting; medical clearance if symptoms or known disease.', 'riebe'], ['Cardio', 'At least 150 min a week moderate (40 to 59% heart-rate reserve) or 75 min vigorous, built up gradually.', 'garber', 'who'], ['Resistance', 'Every major muscle group at least 2 days a week; 2 to 3 sets of 8 to 12 at about 60 to 70% 1RM (start at 40 to 50% if very deconditioned or older).', 'currier', 'garber'], ['Flexibility', '2 to 3 days a week; hold 10 to 30 s, repeat to about 60 s per muscle group.', 'garber'], ['Neuromotor', 'Balance and coordination 2 to 3 days a week, 20 to 30 min.', 'garber']],
  trained: [['Cardio', '150 to 300 min moderate or 75 to 150 min vigorous a week, or a mix.', 'who'], ['Strength', 'Each muscle group at least twice a week; 2 to 3 sets per exercise at 80% 1RM or more for maximal strength.', 'currier'], ['Muscle size', 'About 10 or more hard sets per muscle group per week; stopping 1 to 2 reps short of failure works as well as failure.', 'currier'], ['Flexibility and neuromotor', '2 to 3 days a week each.', 'garber']],
  competitive: [['Strength', '80% 1RM or more for maximal strength; volume and frequency set by the sport calendar.', 'currier'], ['Power', '30 to 70% 1RM moved as fast as possible; stop sets at 10 to 20% velocity loss.', 'currier', 'pareja'], ['Load monitoring', 'Track internal and external load together.', 'bourdon', 'halson'], ['Periodisation', 'Block: accumulation, transmutation, realisation.', 'issurin'], ['Return after a break', 'First 2 to 4 weeks: conditioning volume at 50%, then 70, 80, 90% of the highest volume on file; work:rest 1:4 in week 1, 1:3 in week 2.', 'nsca19', 'ncaa19']],
  elite: [['Conditioning', 'Padel is intermittent and VO₂ is not the limiting factor; prioritise repeated high-intensity and court-specific work over aerobic volume.', 'mellado'], ['Strength', '80% 1RM or more, at least twice a week per muscle group, planned around the match calendar.', 'currier'], ['Power', '30 to 70% 1RM moved fast; velocity-loss limits of 10 to 20% per set.', 'currier', 'pareja'], ['Taper', 'Cut volume about 41 to 60% over roughly two weeks; keep intensity and frequency.', 'bosquet'], ['Load monitoring', 'Internal plus external load. The acute:chronic ratio is a monitoring aid with known flaws, not an injury predictor.', 'bourdon', 'impel'], ['Periodisation', 'Block periodisation around tournaments.', 'issurin'], ['Safety', 'Conditioning is never used as punishment; every session is planned, monitored and shared with the physician.', 'ncaa19', 'casa12'], ['While in rehab', 'The Return plan\'s caps override everything above.', null]]
};
const TIER_ORDER = ['clinical', 'sedentary', 'population', 'trained', 'competitive', 'elite'];
const tierColor = t => { const p = (E.clinicalDomainData.POPULATIONS || []).find(x => x.id === t); return p ? p.color : t === 'clinical' ? '#f87171' : '#a8a29e'; };
const tierName = t => ({ clinical: 'Clinical threshold', population: 'General population', sedentary: 'Sedentary', trained: 'Trained', competitive: 'Competitive', elite: 'Elite' }[t]);
let NPROF = store.get('nprof') || {}; /* per athlete: {sex, age} */
const nprof = id => Object.assign({ sex: ((typeof ATH !== 'undefined' && ATH.find(a => a.id === id)) || {}).sex || 'm', age: id === 'p1' ? '40-49' : '20-29' }, NPROF[id] || {});
const refsFor = (m, pf) => m.refs.filter(r => (!r.sex || r.sex === pf.sex) && (!r.age || r.age === pf.age));
function normVerdict(m, refs, v) {
  if (v == null || v === '' || isNaN(v)) return null;
  const better = (a, b) => m.lower ? a <= b : a >= b; let best = null;
  for (const r of refs) {
    let ok;
    if (r.k === 'cut') ok = r.okIf === 'gt' ? v > r.v : v >= r.v;
    else if (r.k === 'mean') ok = better(v, r.v);
    else ok = m.lower ? v <= Math.max(...r.r) : v >= Math.min(...r.r);
    if (r.k === 'cut') { if (!ok) return { txt: 'Below the clinical threshold: ' + r.label, tone: 'warn' }; continue; }
    if (ok && (!best || TIER_ORDER.indexOf(r.tier) > TIER_ORDER.indexOf(best.tier))) best = r;
  }
  if (best) { const inR = best.k === 'range' && v >= Math.min(...best.r) && v <= Math.max(...best.r); return { txt: (best.k === 'mean' ? 'At or ' + (m.lower ? 'faster than' : 'above') + ': ' : inR ? 'Within: ' : (m.lower ? 'Faster than: ' : 'Above: ')) + best.label, tone: best.tier === 'elite' ? 'ok' : 'mid', tier: best.tier }; }
  return refs.length ? { txt: 'Below every reference shown', tone: 'warn' } : null;
}
function normCard(m, aid, vals) {
  const pf = nprof(aid), refs = refsFor(m, pf), g = GRADES[m.grade], cur = vals[m.id] || {}, v = cur.now, base = cur.base;
  const nums = refs.flatMap(r => r.k === 'range' ? r.r : [r.v]).concat([v, base].filter(x => x != null && x !== '').map(Number));
  let body;
  if (refs.length) {
    const lo = Math.min(...nums), hi = Math.max(...nums), pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.04 || 1), a = lo - pad, b = hi + pad, x = t => ((t - a) / (b - a) * 100).toFixed(2);
    const rows = refs.map((r, i) => r.k === 'range' ? `<span class="nr-seg" style="left:${x(Math.min(...r.r))}%;width:max(4px,${(x(Math.max(...r.r)) - x(Math.min(...r.r))).toFixed(2)}%);--c:${tierColor(r.tier)};top:${8 + i * 10}px" title="${esc(r.label)}"></span>` : `<span class="nr-tick${r.k === 'cut' ? ' cut' : ''}" style="left:${x(r.v)}%;--c:${tierColor(r.tier)};top:${4 + i * 10}px" title="${esc(r.label)}"></span>`).join('');
    const mk = (t, cls, lab) => t != null && t !== '' ? `<i class="nr-v ${cls}" style="left:${x(+t)}%"><em>${lab} ${esc(String(t))}</em></i>` : '';
    body = `<div class="nr-track" style="height:${Math.max(40, 20 + refs.length * 10)}px">${rows}${mk(base, 'b', 'Base')}${mk(v, '', 'Now')}</div>
      <ul class="nr-legend">${refs.map(r => `<li><i style="background:${tierColor(r.tier)}"></i><b>${esc(tierName(r.tier))}</b> ${r.k === 'range' ? r.r.join(' to ') : (r.k === 'cut' ? (r.up ? '≥ ' : '') : '') + r.v} ${esc(m.unit.split(',')[0])} · ${esc(r.label)}</li>`).join('')}</ul>`;
  } else body = `<div class="nr-indiv">${base != null && base !== '' && v != null && v !== '' ? `<b>${(+v - +base >= 0 ? '+' : '') + (+v - +base).toFixed(2)}</b> vs baseline` : 'No population band: his baseline is the reference.'}</div>`;
  const vd = refs.length ? normVerdict(m, refs, v) : null;
  return `<article class="nr" data-grade="${m.grade}"><header class="nr-h"><span class="nr-g g-${m.grade}" title="${esc(g[1] + '. ' + g[2])}">${g[0]}</span><div><b>${esc(m.metric)}</b><span class="muted">${esc(m.unit)} · ${esc(m.protocol)}</span></div>${vd ? `<span class="chip plain nr-vd t-${vd.tone}">${esc(vd.txt)}</span>` : ''}</header>
    ${body}
    <div class="nr-in"><label>Baseline<input type="number" step="any" value="${base != null ? esc(String(base)) : ''}" data-nv2="${aid}|${m.id}|base" aria-label="${esc(m.metric)} baseline"></label><label>Latest<input type="number" step="any" value="${v != null ? esc(String(v)) : ''}" data-nv2="${aid}|${m.id}|now" aria-label="${esc(m.metric)} latest"></label></div>
    ${m.note ? `<p class="nr-note">${esc(m.note)}</p>` : ''}
    <details class="nr-src"><summary>Sources · grade ${m.grade}: ${esc(g[1])}</summary><ol>${m.src.map(k => `<li><a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].cite)}</a></li>`).join('')}</ol></details></article>`;
}
function popFramework(active) {
  return `<section class="panel"><div class="sec-head"><div><h2>Who counts as sedentary, trained, competitive, elite</h2><span class="muted" style="font-size:13px">McKay et al. 2022 Participant Classification Framework, mapped to our four populations</span></div></div>
    <div class="pf-grid">${POP_FRAME.map(p => `<div class="pf${p.id === active ? ' on' : ''}" style="--c:${tierColor(p.id)}"><span class="eyebrow">${esc(p.tier)}</span><b>${esc(p.label)}</b><span>${esc(p.def)}</span></div>`).join('')}</div>
    <details class="nr-src" open><summary>Where each number comes from</summary><dl class="pf-roles">${SOURCE_ROLES.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    <div class="pf-grades">${Object.values(GRADES).map(g => `<span><i class="nr-g g-${g[0]}">${g[0]}</i><b>${esc(g[1])}</b> ${esc(g[2])}</span>`).join('')}</div></details></section>`;
}
function rxEvidence(pop) {
  return `<section class="panel"><div class="sec-head"><div><h2>Prescription · ${esc(tierName(pop))}</h2><span class="muted" style="font-size:13px">Every line carries its source. Lines without one are team practice.</span></div></div>
    <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${RXP[pop].map(([l, t, ...s]) => `<div class="rx-c" style="--c:${tierColor(pop)}"><span class="eyebrow">${esc(l)}</span><span>${esc(t)}</span>${s.filter(Boolean).length ? `<span class="rx-s">${s.filter(Boolean).map(k => `<a href="${SRC[k].url}" target="_blank" rel="noopener">${esc(SRC[k].cite.split('.')[0])} ${esc((SRC[k].cite.match(/(19|20)\d\d/) || [''])[0])}</a>`).join(' · ')}</span>` : '<span class="rx-s muted">Team practice</span>'}</div>`).join('')}</div></section>`;
}
function normsPanel(aid, pop) {
  const pf = nprof(aid), vals = (NORMV.v2 || {})[aid] || {}, doms = [...new Set(NORMS.map(m => m.domain))];
  const graded = NORMS.filter(m => refsFor(m, pf).length), tested = NORMS.filter(m => vals[m.id] && vals[m.id].now != null);
  return `<section class="panel np-bar"><div class="sec-head"><div><h2>Testing standards</h2><span class="muted" style="font-size:13px">${graded.length} metrics with published references for this sex and age; ${NORMS.length - graded.length} tracked against baseline only · ${tested.length} tested</span></div>
    <div class="pills"><button class="pill" data-np="${aid}|sex|m" aria-pressed="${pf.sex === 'm'}">Male</button><button class="pill" data-np="${aid}|sex|f" aria-pressed="${pf.sex === 'f'}">Female</button><span style="width:10px"></span><button class="pill" data-np="${aid}|age|20-29" aria-pressed="${pf.age === '20-29'}">20 to 29</button><button class="pill" data-np="${aid}|age|30-39" aria-pressed="${pf.age === '30-39'}">30 to 39</button><button class="pill" data-np="${aid}|age|40-49" aria-pressed="${pf.age === '40-49'}">40 to 49</button></div></div></section>
  ${doms.map(d => `<section class="panel"><div class="sec-head"><h2>${esc(d)}</h2></div><div class="nr-list">${NORMS.filter(m => m.domain === d).map(m => normCard(m, aid, vals)).join('')}</div></section>`).join('')}`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-np]'); if (!b) return; const [aid, k, v] = b.dataset.np.split('|'); NPROF[aid] = Object.assign(nprof(aid), { [k]: v }); store.set('nprof', NPROF); keepRender(); });
document.addEventListener('change', e => { const t = e.target; if (!t || !t.dataset || t.dataset.nv2 === undefined) return; const [aid, id, f] = t.dataset.nv2.split('|'); NORMV.v2 = NORMV.v2 || {}; NORMV.v2[aid] = NORMV.v2[aid] || {}; const r = NORMV.v2[aid][id] = NORMV.v2[aid][id] || {}; if (t.value === '') delete r[f]; else r[f] = +t.value; store.set('normv', NORMV); audit('Entered a test result', id + ' (' + f + ')'); keepRender(); });
window.__N = { NORMS, SRC, normVerdict, refsFor };
