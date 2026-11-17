package com.visordatossig.operaciones.data.remote

import com.visordatossig.operaciones.data.remote.dto.ChangePasswordRequestDto
import com.visordatossig.operaciones.data.remote.dto.IngestTrackingPointDto
import com.visordatossig.operaciones.data.remote.dto.LoginEnvelopeDto
import com.visordatossig.operaciones.data.remote.dto.LoginRequestDto
import com.visordatossig.operaciones.data.remote.dto.MobileAssignmentSheetDto
import com.visordatossig.operaciones.data.remote.dto.MobileExecutionResultDto
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface OperacionesApi {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequestDto): LoginEnvelopeDto

    @POST("api/auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequestDto): Response<Unit>

    @GET("api/mobile/mis-asignaciones")
    suspend fun getMisAsignaciones(): List<MobileAssignmentSheetDto>

    @POST("api/mobile/tracking")
    suspend fun sendTracking(@Body point: IngestTrackingPointDto): Response<Unit>

    @Multipart
    @POST("api/mobile/ejecutar-corte")
    suspend fun ejecutarCorte(
        @Part("idAsignacionDetalle") idAsignacionDetalle: RequestBody,
        @Part("estado") estado: RequestBody,
        @Part("lecturaMedidor") lecturaMedidor: RequestBody,
        @Part("observacion") observacion: RequestBody,
        @Part("latitudEjecucion") latitudEjecucion: RequestBody,
        @Part("longitudEjecucion") longitudEjecucion: RequestBody,
        @Part foto: MultipartBody.Part? = null
    ): MobileExecutionResultDto
}
