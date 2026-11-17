package com.visordatossig.operaciones.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "geoit_session_prefs")

data class UserSession(
    val userId: Int,
    val login: String,
    val name: String,
    val role: String,
    val accessToken: String,
    val refreshToken: String,
    val serverBaseUrl: String,
    val isRouteActive: Boolean
)

@Singleton
class SessionPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val KEY_USER_ID = intPreferencesKey("user_id")
        private val KEY_LOGIN = stringPreferencesKey("user_login")
        private val KEY_NAME = stringPreferencesKey("user_name")
        private val KEY_ROLE = stringPreferencesKey("user_role")
        private val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val KEY_SERVER_URL = stringPreferencesKey("server_base_url")
        private val KEY_ROUTE_ACTIVE = booleanPreferencesKey("route_active")

        const val DEFAULT_BASE_URL = "https://api-visordatossig.devhooh.com/"
    }

    @Volatile
    var cachedAccessToken: String = ""
        private set

    @Volatile
    var cachedBaseUrl: String = DEFAULT_BASE_URL
        private set

    private val _sessionExpiredEvent = MutableStateFlow(false)
    val sessionExpiredEvent: StateFlow<Boolean> = _sessionExpiredEvent.asStateFlow()

    fun notifySessionExpired() {
        cachedAccessToken = ""
        _sessionExpiredEvent.value = true
        CoroutineScope(Dispatchers.IO).launch {
            clearSession()
        }
    }

    fun consumeSessionExpiredNotice(): Boolean {
        val value = _sessionExpiredEvent.value
        _sessionExpiredEvent.value = false
        return value
    }

    val sessionFlow: Flow<UserSession> = context.dataStore.data.map { prefs ->
        val token = prefs[KEY_ACCESS_TOKEN] ?: ""
        val baseUrl = normalizeBaseUrl(prefs[KEY_SERVER_URL] ?: DEFAULT_BASE_URL)
        cachedAccessToken = token
        cachedBaseUrl = baseUrl
        UserSession(
            userId = prefs[KEY_USER_ID] ?: 0,
            login = prefs[KEY_LOGIN] ?: "",
            name = prefs[KEY_NAME] ?: "",
            role = prefs[KEY_ROLE] ?: "Cortador",
            accessToken = token,
            refreshToken = prefs[KEY_REFRESH_TOKEN] ?: "",
            serverBaseUrl = baseUrl,
            isRouteActive = prefs[KEY_ROUTE_ACTIVE] ?: false
        )
    }

    suspend fun getSessionSnapshot(): UserSession = sessionFlow.first()

    suspend fun saveAuthSession(
        userId: Int,
        login: String,
        name: String,
        role: String,
        accessToken: String,
        refreshToken: String,
        serverBaseUrl: String
    ) {
        val normalized = normalizeBaseUrl(serverBaseUrl)
        cachedAccessToken = accessToken
        cachedBaseUrl = normalized
        context.dataStore.edit { prefs ->
            prefs[KEY_USER_ID] = userId
            prefs[KEY_LOGIN] = login
            prefs[KEY_NAME] = name
            prefs[KEY_ROLE] = role
            prefs[KEY_ACCESS_TOKEN] = accessToken
            prefs[KEY_REFRESH_TOKEN] = refreshToken
            prefs[KEY_SERVER_URL] = normalized
        }
    }

    suspend fun updateServerUrl(serverBaseUrl: String) {
        val normalized = normalizeBaseUrl(serverBaseUrl)
        cachedBaseUrl = normalized
        context.dataStore.edit { prefs ->
            prefs[KEY_SERVER_URL] = normalized
        }
    }

    suspend fun setRouteActive(active: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[KEY_ROUTE_ACTIVE] = active
        }
    }

    suspend fun clearSession() {
        cachedAccessToken = ""
        context.dataStore.edit { prefs ->
            prefs.remove(KEY_USER_ID)
            prefs.remove(KEY_LOGIN)
            prefs.remove(KEY_NAME)
            prefs.remove(KEY_ROLE)
            prefs.remove(KEY_ACCESS_TOKEN)
            prefs.remove(KEY_REFRESH_TOKEN)
            prefs[KEY_ROUTE_ACTIVE] = false
        }
    }

    fun normalizeBaseUrl(raw: String): String {
        val trimmed = raw.trim().ifEmpty { DEFAULT_BASE_URL }
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}
