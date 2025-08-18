from calendar_puzzle.shape import Shape


class DroppedBlock(object):
    """A shape placed on the calendar puzzle board.
    
    Immutable data structure representing a shape at a specific position.
    Once created, the shape and its position cannot be changed.
    
    Attributes:
        shape: The Shape instance being placed
        x: Leftmost column coordinate (0-based)
        y: Topmost row coordinate (0-based)
    """
    
    def __init__(self, shape: Shape, x: int, y: int):
        """Create a new dropped block.
        
        Args:
            shape: The Shape instance to place
            x: Leftmost column coordinate (must be non-negative)
            y: Topmost row coordinate (must be non-negative)
        """
        self.shape = shape
        self.x = x
        self.y = y
    
    def __str__(self) -> str:
        return f"{self.shape.name} at ({self.x}, {self.y})"
    
    def __repr__(self) -> str:
        return f"DroppedBlock({self.shape!r}, {self.x}, {self.y})"
    
    def __hash__(self) -> int:
        return hash((self.shape, self.x, self.y))
    
    def __eq__(self, other):
        if not isinstance(other, type(self)):
            return NotImplemented
        return (self.shape == other.shape and 
                self.x == other.x and 
                self.y == other.y)
    
    def __lt__(self, other):
        if not isinstance(other, type(self)):
            return NotImplemented
        return (self.y, self.x, self.shape) < (other.y, other.x, other.shape)