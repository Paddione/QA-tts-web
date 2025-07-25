# Database Systems - Core Knowledge

## Why Database Systems Are Needed

Database systems are essential for managing data with several key requirements:

**Persistent Data Storage**: Data must be stored permanently and be recoverable.

**Flexible Search Access**: Must support various search queries:
- Show entry for a specific person
- Show all entries from a specific city  
- Find entries by phone number
- Sort by different criteria

**Result-Oriented Operations**: Users should describe what they want, not how to get it.

**Redundancy Avoidance**: Data should be stored only once to prevent inconsistencies.

**Multi-User Support**: Multiple users must be able to access data simultaneously.

## Relational Database Systems

### Tables and Relations

A **table** is a concrete representation of a **relation**. Relations are mathematical concepts described through value tables containing the data.

### Key Concepts

**Entities**: Objects in the real world that have multiple properties and can be uniquely identified.

**Attributes**: Properties of entities. Each attribute has:
- Attribute name (must be unique)
- Attribute values  
- Attribute type (data type)

**Relations**: A set of objects described by a uniform combination of attributes.

**Tuples**: Individual records/rows in a relation.

### Relational Model Characteristics

The relational model is characterized by three aspects:

1. **Structural Aspect**: Data can only be viewed and modified in table form
2. **Manipulative Aspect**: All operators work on tables and produce tables  
3. **Integrity Aspect**: Tables must satisfy certain integrity conditions

## Database Keys

### Primary Keys

A **primary key** is an attribute or combination of attributes that uniquely identifies each record in a table.

**Good Primary Key Criteria**:
- Contains no user-relevant information
- Simple structure
- Values never change
- Typically use artificial ID fields

### Candidate Keys

A **candidate key** is a set of attributes that:
- Uniquely identifies each record (uniqueness)
- Cannot be reduced without losing uniqueness (minimality)

### Foreign Keys

A **foreign key** is a set of attributes in one table that references the primary key of another table.

## Database Integrity

### Entity Integrity
Primary key values cannot be NULL.

### Referential Integrity
Every foreign key value must have a corresponding primary key value in the referenced table.

### Integrity Constraint Actions

**On Delete**:
- RESTRICT: Prevent deletion if referenced
- CASCADE: Delete all referencing records  

**On Update**:
- RESTRICT: Prevent update if referenced
- CASCADE: Update all referencing foreign keys
- NULLIFY: Set foreign keys to NULL

## Relational Operators

### Basic Set Operations
- **UNION**: Combine two compatible relations
- **INTERSECTION**: Common records of two relations  
- **DIFFERENCE**: Records in first but not second relation

### Relational Operations
- **PRODUCT**: Cartesian product of two relations
- **RESTRICT/WHERE**: Filter records meeting conditions
- **PROJECT**: Select specific attributes
- **JOIN**: Combine related tables
- **DIVIDE**: Reverse of product operation

### Join Types
- **NATURAL JOIN**: Join on equal values, remove duplicate attributes
- **EQUIJOIN**: Join on equal values, keep duplicate attributes
- **THETA JOIN**: Join using comparison operators (<, >, ≤, ≥, ≠, =)

## Entity/Relationship (E/R) Modeling

### Entity Types
Groups of entities sharing common attributes and described by the same concept.

### Relationship Types

**1:1 Relationships**:
- Each entity relates to at most one entity in the other type
- Can be conditional (optional) or non-conditional (mandatory)

**1:n Relationships**:  
- One entity relates to many entities
- Many entities relate to one entity

**m:n Relationships**:
- Many-to-many relationships
- Require separate relationship tables

### Cardinality Notations
- **[min, max]**: Minimum and maximum occurrences
- **Simple notation**: 1, n, m with 'c' for conditional
- **Arrow notation**: Arrows show direction of relationships

## Normalization

### Functional Dependency
Attribute Y is functionally dependent on X if each X value determines exactly one Y value.
Written as: X → Y

### Normal Forms

**First Normal Form (1NF)**:
All attributes contain only atomic (indivisible) values.

**Second Normal Form (2NF)**:
- In 1NF
- No non-key attribute depends on part of a composite primary key

**Third Normal Form (3NF)**:
- In 2NF
- No non-key attribute depends transitively on the primary key

**Boyce-Codd Normal Form (BCNF)**:
- In 1NF  
- Every non-trivial functional dependency has a candidate key as determinant

### Transitive Dependency
X₁ → X₂ → X₃ where X₁ and X₂ are not equivalent.

## Database Design Process

1. **Requirements Analysis**: Understand the application domain
2. **Conceptual Design**: Create E/R model
3. **Logical Design**: Convert to relational schema
4. **Normalization**: Apply normal forms to eliminate redundancy
5. **Physical Design**: Optimize for performance

## Constraints and Data Types

**Domain Constraints**: Restrict attribute values to valid ranges
**Key Constraints**: Ensure uniqueness of primary keys
**Referential Constraints**: Maintain foreign key relationships
**Check Constraints**: Custom business rules

**Common Data Types**:
- INTEGER: Whole numbers
- VARCHAR(n): Variable-length strings up to n characters
- FLOAT/DECIMAL: Decimal numbers
- DATE: Date values
- BOOLEAN: True/false values

## NULL Values

**Problems with NULL**:
- Complicate query logic
- Require special handling in operations
- Can lead to unexpected results

**Best Practice**: Avoid NULL values when possible by using:
- Default values
- Separate tables for optional attributes  
- Special indicator values

## Performance Considerations

**Indexing**: Primary keys automatically indexed for fast access
**Query Optimization**: DBMS optimizes query execution plans
**Normalization vs Performance**: Sometimes denormalization needed for performance
**Join Costs**: Multiple joins can impact performance

This knowledge forms the foundation for understanding and designing relational database systems. 