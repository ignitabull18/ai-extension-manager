import chromeP from "webext-polyfill-kinda"

export const sendMessage = async (message, params) => {
  try {
    const msg = {
      id: message,
      params: params
    }
    return await chromeP.runtime.sendMessage(JSON.stringify(msg))
  } catch (error) {
    console.log("sendMessage", error)
  }
}

export const listen = async (message, ctx, callback) => {
  const msg = JSON.parse(ctx.message)
  if (message !== msg.id) {
    return false
  }

  try {
    const result = callback?.({
      ...ctx,
      id: msg.id,
      params: msg.params
    })
    
    // Await if callback returns a promise
    if (result && typeof result.then === 'function') {
      await result
    }
    
    return true
  } catch (error) {
    // If callback throws an error and hasn't sent a response yet, send error response
    // Note: This is a fallback - handlers should catch their own errors and send responses
    // But this ensures we always send a response even if a handler fails unexpectedly
    try {
      ctx.sendResponse({
        state: "error",
        error: error.message || "Handler error"
      })
    } catch (sendError) {
      // Response already sent or port closed - ignore
      console.error("[MessageHelper] Failed to send error response", sendError)
    }
    return true // Return true to indicate message was handled (even if with error)
  }
}
