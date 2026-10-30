
export interface LivePhrase { phrase: string; language: "en"|"hi"|"ta"|"kn"|"ml"|"code-mixed"; category: "relative-date"|"landmark"|"correction"|"plan-event"|"negation"|"log"; expectedIntent?: string; }
const en: LivePhrase[] = [
 {phrase:"Period started yesterday, heavy flow with cramps",language:"en",category:"relative-date"},
 {phrase:"Period started 3 days ago",language:"en",category:"relative-date"},
 {phrase:"Light flow today, no cramps",language:"en",category:"negation"},
 {phrase:"Feeling tired, no flow",language:"en",category:"negation"},
 {phrase:"Period ended yesterday",language:"en",category:"log"},
 {phrase:"Period started 2 days before New Year's Day",language:"en",category:"landmark"},
 {phrase:"Period started on Christmas",language:"en",category:"landmark"},
 {phrase:"Exam on Nov 20",language:"en",category:"plan-event"},
 {phrase:"Wedding on 3rd November",language:"en",category:"plan-event"},
 {phrase:"Actually it was light, not heavy",language:"en",category:"correction"},
 {phrase:"Change that to yesterday",language:"en",category:"correction"},
 {phrase:"My period is late",language:"en",category:"log"},
];
const mk=(language:LivePhrase["language"], phrases:string[]):LivePhrase[]=>phrases.map((phrase,i)=>({phrase,language,category:(["log","relative-date","negation","plan-event","correction"] as const)[i%5]}));
export const LIVE_PHRASES: LivePhrase[] = [
 ...en,
 ...mk("hi",["आज कमर दर्द है","कल पीरियड शुरू हुआ","तीन दिन पहले हल्का फ्लो था","कोई दर्द नहीं है","20 नवंबर को परीक्षा है","नहीं, भारी नहीं हल्का था","आज थकान है, फ्लो नहीं","परसों पीरियड खत्म हुआ","दिवाली पर पीरियड शुरू हुआ","पिछले मंगलवार को शुरू हुआ","क्रिसमस के बाद परीक्षा है","हल्का सिरदर्द है"]),
 ...mk("ta",["நேற்று மாதவிடாய் தொடங்கியது","இன்று லேசான ஓட்டம்","வலி இல்லை","மூன்று நாட்களுக்கு முன் தொடங்கியது","நவம்பர் 20 தேர்வு","கனமாக இல்லை, லேசாக","சோர்வாக உள்ளது, ஓட்டம் இல்லை","நேற்று முடிந்தது","கடந்த செவ்வாய் தொடங்கியது","பொங்கல் அன்று தொடங்கியது","கிறிஸ்துமஸுக்கு பிறகு பயணம்","தலைவலி மட்டும்"]),
 ...mk("kn",["ನಿನ್ನೆ ಪಿರಿಯಡ್ ಶುರುವಾಯಿತು","ಇಂದು ಹಗುರ ಹರಿವು","ನೋವು ಇಲ್ಲ","ಮೂರು ದಿನಗಳ ಹಿಂದೆ ಶುರುವಾಯಿತು","ನವೆಂಬರ್ 20 ಪರೀಕ್ಷೆ","ಭಾರವಲ್ಲ, ಹಗುರ","ದಣಿವಿದೆ, ಹರಿವು ಇಲ್ಲ","ನಿನ್ನೆ ಮುಗಿಯಿತು","ಕಳೆದ ಮಂಗಳವಾರ ಶುರುವಾಯಿತು","ದೀಪಾವಳಿಗೆ ಶುರುವಾಯಿತು","ಕ್ರಿಸ್ಮಸ್ ನಂತರ ಪ್ರಯಾಣ","ತಲೆನೋವು ಮಾತ್ರ"]),
 ...mk("ml",["ഇന്നലെ പീരിയഡ് തുടങ്ങി","ഇന്ന് ലഘുവായ ഒഴുക്ക്","വേദന ഇല്ല","മൂന്ന് ദിവസം മുൻപ് തുടങ്ങി","നവംബർ 20 പരീക്ഷ","ഭാരമല്ല, ലഘുവാണ്","ക്ഷീണമുണ്ട്, ഒഴുക്ക് ഇല്ല","ഇന്നലെ അവസാനിച്ചു","കഴിഞ്ഞ ചൊവ്വ തുടങ്ങി","ഓണത്തിന് തുടങ്ങി","ക്രിസ്മസിന് ശേഷം യാത്ര","തലവേദന മാത്രം"]),
 ...mk("code-mixed",["Period started 2 days before Diwali","Exam hai Nov 20 ko","Flow light hai today, no cramps","Kal period start hua tha","Heavy nahi, light tha","Trip on Christmas, period check karo"]),
];
