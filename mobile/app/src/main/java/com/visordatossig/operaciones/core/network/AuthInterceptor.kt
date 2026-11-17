package com.visordatossig.operaciones.core.network

import com.visordatossig.operaciones.core.datastore.SessionPreferences
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val sessionPreferences: SessionPreferences
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = sessionPreferences.cachedAccessToken
        val builder = original.newBuilder()

        if (token.isNotBlank() && original.header("Authorization") == null) {
            builder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(builder.build())

        // Si el servidor responde 401 en cualquier llamada autenticada, notificar expiración de sesión
        if (response.code == 401 && !original.url.encodedPath.endsWith("api/auth/login")) {
            sessionPreferences.notifySessionExpired()
        }

        return response
    }
}
