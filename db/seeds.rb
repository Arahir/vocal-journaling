unless ENV["DEMO_DATA"] == "true"
  puts "Aucune donnée de démo créée. Lance DEMO_DATA=true bin/rails db:seed pour remplir l'UI."
else
  user = User.find_or_create_by!(email_address: "demo@example.com") do |created_user|
    created_user.password = "password"
    created_user.password_confirmation = "password"
  end

  dates = [ Date.current - 2.days, Date.current - 1.day, Date.current ]
  user.journal_entries.where(entry_date: dates).destroy_all

  entries = [
    {
      entry_date: dates[0],
      raw_text: "Matin calme, café et tartines. Déjeuner rapide avec salade quinoa poulet. Bonne énergie l'après-midi. Dîner pâtes tomate basilic.",
      summary: "Tu as eu une journée plutôt stable, avec un démarrage calme et une bonne énergie l'après-midi. Les repas étaient simples et réguliers. Le soir, tu as gardé quelque chose de confortable avec des pâtes.",
      meals: [
        [ "breakfast", "café, tartines" ],
        [ "lunch", "salade quinoa poulet" ],
        [ "dinner", "pâtes tomate basilic" ]
      ]
    },
    {
      entry_date: dates[1],
      raw_text: "Réveil fatigué. Yaourt et banane. Déj riz légumes tofu. J'ai grignoté une pomme vers 17h. Soirée tranquille, soupe et pain.",
      summary: "Tu as commencé la journée avec une fatigue sensible. Le rythme est resté assez doux, avec des repas plutôt légers. La soirée semble avoir été calme et récupératrice.",
      meals: [
        [ "breakfast", "yaourt, banane" ],
        [ "lunch", "riz, légumes, tofu" ],
        [ "snack", "pomme" ],
        [ "dinner", "soupe, pain" ]
      ]
    },
    {
      entry_date: dates[2],
      raw_text: "Journée dense mais motivante. Café seulement le matin, gros déjeuner omelette salade. Snack chocolat après une réunion. Pas encore décidé pour ce soir.",
      summary: "Tu as vécu une journée dense, mais portée par une motivation présente. Le matin a été minimal côté alimentation, puis le déjeuner a été plus consistant. La réunion semble avoir créé un petit besoin de réconfort ensuite.",
      meals: [
        [ "breakfast", "café" ],
        [ "lunch", "omelette, salade" ],
        [ "snack", "chocolat" ]
      ]
    }
  ]

  entries.each do |attributes|
    entry = user.journal_entries.create!(
      entry_date: attributes.fetch(:entry_date),
      raw_text: attributes.fetch(:raw_text),
      summary: attributes.fetch(:summary),
      processed_at: Time.current
    )

    attributes.fetch(:meals).each do |meal_type, description|
      entry.meals.create!(meal_type:, description:)
    end
  end

  puts "Compte démo créé : demo@example.com / password"
  puts "Supprime les données démo avec : User.find_by(email_address: 'demo@example.com')&.destroy!"
end
