import asyncio
import logging

logger = logging.getLogger(__name__)

# Global cache for storing decrypted paper PDFs in RAM
# Key: print_session_id (str), Value: decrypted_pdf_bytes (bytes)
DECRYPTED_PAPER_CACHE: dict[str, bytes] = {}

async def schedule_cache_wipe(session_id: str, delay_seconds: float):
    """
    Asynchronous background task to remove a decrypted PDF from the RAM cache
    after the print authorization window has expired.
    """
    try:
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)
        
        if session_id in DECRYPTED_PAPER_CACHE:
            del DECRYPTED_PAPER_CACHE[session_id]
            logger.info(f"Successfully wiped print session {session_id} from in-memory cache.")
    except Exception as e:
        logger.error(f"Error in schedule_cache_wipe for session {session_id}: {str(e)}")
