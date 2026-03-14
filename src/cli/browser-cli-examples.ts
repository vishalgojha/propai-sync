export const browserCoreExamples = [
  "propai browser status",
  "propai browser start",
  "propai browser stop",
  "propai browser tabs",
  "propai browser open https://example.com",
  "propai browser focus abcd1234",
  "propai browser close abcd1234",
  "propai browser screenshot",
  "propai browser screenshot --full-page",
  "propai browser screenshot --ref 12",
  "propai browser snapshot",
  "propai browser snapshot --format aria --limit 200",
  "propai browser snapshot --efficient",
  "propai browser snapshot --labels",
];

export const browserActionExamples = [
  "propai browser navigate https://example.com",
  "propai browser resize 1280 720",
  "propai browser click 12 --double",
  'propai browser type 23 "hello" --submit',
  "propai browser press Enter",
  "propai browser hover 44",
  "propai browser drag 10 11",
  "propai browser select 9 OptionA OptionB",
  "propai browser upload /tmp/propai/uploads/file.pdf",
  'propai browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "propai browser dialog --accept",
  'propai browser wait --text "Done"',
  "propai browser evaluate --fn '(el) => el.textContent' --ref 7",
  "propai browser console --level error",
  "propai browser pdf",
];




