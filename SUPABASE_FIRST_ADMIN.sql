-- Après avoir créé ton propre compte Bleus 3000, remplace l'e-mail ci-dessous.
update public.profiles
set role='superadmin'
where lower(email)=lower('TON_EMAIL_ICI');
