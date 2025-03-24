import logging
import spacy
import re

logger = logging.getLogger(__name__)

class EntityExtractor:
    """Class to handle named entity recognition and addressee extraction"""
    
    def __init__(self, model_name="en_core_web_sm"):
        """
        Initialize the EntityExtractor with a specific spaCy model
        
        Args:
            model_name (str): The spaCy model to use
        """
        logger.info(f"Initializing EntityExtractor with model: {model_name}")
        
        try:
            self.nlp = spacy.load(model_name)
            logger.info(f"Successfully loaded spaCy model: {model_name}")
        except Exception as e:
            logger.error(f"Error loading spaCy model: {e}")
            raise
    
    def extract_entities(self, text):
        """
        Extract named entities from text
        
        Args:
            text (str): The text to extract entities from
            
        Returns:
            list: List of extracted entities with their types
        """
        logger.info("Extracting entities from text")
        
        try:
            doc = self.nlp(text)
            entities = [{"text": ent.text, "type": ent.label_} for ent in doc.ents]
            logger.info(f"Extracted {len(entities)} entities")
            return entities
        
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            raise
    
    def extract_addressee(self, text):
        """
        Extract the addressee from text
        
        Args:
            text (str): The text to extract the addressee from
            
        Returns:
            str: The extracted addressee, or None if not found
        """
        logger.info("Extracting addressee from text")
        
        try:
            # Extract using pattern matching first
            pattern_addressee = self._extract_addressee_patterns(text)
            if pattern_addressee:
                logger.info(f"Extracted addressee using patterns: {pattern_addressee}")
                return pattern_addressee
            
            # Then try NER
            entities = self.extract_entities(text)
            person_entities = [entity["text"] for entity in entities if entity["type"] == "PERSON"]
            
            if person_entities:
                # Prioritize the first mentioned person as the addressee
                addressee = person_entities[0]
                logger.info(f"Extracted addressee using NER: {addressee}")
                return addressee
            
            # If no person entities found, try to extract names from text
            potential_names = self._extract_potential_names(text)
            if potential_names:
                logger.info(f"Extracted potential addressee: {potential_names[0]}")
                return potential_names[0]
            
            logger.info("No addressee found")
            return None
        
        except Exception as e:
            logger.error(f"Error extracting addressee: {e}")
            raise
    
    def _extract_addressee_patterns(self, text):
        """
        Extract addressee using common speech patterns
        
        Args:
            text (str): The text to extract from
            
        Returns:
            str: The extracted addressee, or None if not found
        """
        # Common patterns for addressing someone
        patterns = [
            r"Hey\s+(\w+)",
            r"Hi\s+(\w+)",
            r"Hello\s+(\w+)",
            r"(\w+),\s+this is for you",
            r"This is for\s+(\w+)",
            r"For\s+(\w+)",
            r"(\w+),\s+listen",
            r"(\w+),\s+please",
            r"(\w+),\s+can you",
            r"(\w+),\s+I need",
            r"(\w+),\s+I want",
            r"Listen\s+(\w+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_potential_names(self, text):
        """
        Extract potential names from text
        
        Args:
            text (str): The text to extract from
            
        Returns:
            list: List of potential names
        """
        # Process with spaCy
        doc = self.nlp(text)
        
        # Get noun chunks that could be names
        potential_names = []
        
        # Check for proper nouns
        for token in doc:
            if token.pos_ == "PROPN" and len(token.text) > 1:
                potential_names.append(token.text)
        
        # Check noun chunks
        for chunk in doc.noun_chunks:
            # Only consider short noun chunks (1-2 words) as potential names
            if 1 <= len(chunk.text.split()) <= 2 and chunk.text not in potential_names:
                potential_names.append(chunk.text)
        
        return potential_names
