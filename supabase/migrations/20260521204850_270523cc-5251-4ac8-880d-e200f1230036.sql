revoke all on function public.current_user_negocio() from public;
revoke all on function public.current_user_negocio() from authenticated;
revoke all on function public.current_user_negocio() from anon;
revoke all on function public.registrar_negocio_y_admin(uuid,text,text,text,text,text,text,text) from anon;