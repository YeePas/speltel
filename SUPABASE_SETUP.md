# Supabase setup

1. Open Supabase SQL Editor en run `supabase/schema.sql`.
2. Vul daarna in `config.js` deze velden in:
   - `supabaseUrl`
   - `supabaseAnonKey`
3. Herlaad de app op `http://localhost:8080`.
4. In de app kun je direct syncen met:
   - room invullen in het veld `Family / Room code`
   - `Lokaal -> Cloud`
   - `Cloud -> Lokaal`

## Voorbeeld config.js

```js
window.SPELTELLER_CONFIG = {
  supabaseUrl: "https://jouwproject.supabase.co",
   supabaseAnonKey: "eyJ..."
};
```

## Belangrijk

- De anon key is bedoeld voor client-side gebruik.
- Met de huidige policy in `supabase/schema.sql` kan iedereen met URL + key + room lezen/schrijven.
- Zet dit alleen zo in voor prototype/familiegebruik.
