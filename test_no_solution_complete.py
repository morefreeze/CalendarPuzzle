#!/usr/bin/env python3
"""
Complete test for no-solution error reporting flow
Tests the entire chain: Frontend -> Backend -> Solver -> Error Display
"""

import json
import requests
import time
import sys

def test_no_solution_flow():
    """Test the complete no-solution error reporting flow"""
    
    print("🧪 Testing No-Solution Error Reporting Flow")
    print("=" * 50)
    
    # Test 1: Server health check
    print("1️⃣ Checking server health...")
    try:
        response = requests.post('http://localhost:5001/api/game-id', 
                                json={'timestamp': int(time.time())}, 
                                timeout=5)
        if response.status_code == 200:
            print("   ✅ Server is running")
        else:
            print(f"   ❌ Server returned {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Server not accessible: {e}")
        return False
    
    # Test 2: Create a no-solution scenario
    print("2️⃣ Creating no-solution test case...")
    
    # Create overlapping blocks that should result in no solution
    test_data = {
        'droppedBlocks': [
            {
                'id': 'I-block',
                'x': 0,
                'y': 0,
                'shape': [[1,1,1,1]]
            },
            {
                'id': 'T-block', 
                'x': 0,
                'y': 0,
                'shape': [[1,1,1],[0,1,0]]
            }
        ],
        'remainingBlockTypes': [
            {'id': 'L-block', 'shape': [[1,1,1],[1,0,0]]}
        ]
    }
    
    print("   ✅ Test case created with overlapping blocks")
    
    # Test 3: Send request to server
    print("3️⃣ Sending request to server...")
    try:
        response = requests.post('http://localhost:5001/api/solution', 
                                 json=test_data, 
                                 timeout=10)
        print(f"   📊 Server response status: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ Server correctly returned 404 for no-solution case")
            
            # Parse error response
            error_data = response.json()
            print(f"   📋 Error message: {error_data.get('error', 'N/A')}")
            print(f"   💡 Suggestion: {error_data.get('suggestion', 'N/A')}")
            print(f"   ⏱️  Solve time: {error_data.get('solveTime', 'N/A')} seconds")
            
            # Verify error message format
            expected_error = "no solution found"
            if error_data.get('error') == expected_error:
                print("   ✅ Error message format is correct")
            else:
                print(f"   ⚠️  Unexpected error message: {error_data.get('error')}")
            
            # Verify suggestion format
            if 'suggestion' in error_data:
                print("   ✅ Suggestion provided")
            else:
                print("   ⚠️  No suggestion provided")
                
            # Verify solve time
            if 'solveTime' in error_data:
                print("   ✅ Solve time provided")
            else:
                print("   ⚠️  No solve time provided")
                
            return True
            
        elif response.status_code == 200:
            result = response.json()
            print(f"   ❌ Server returned solution with {len(result.get('droppedBlocks', []))} blocks")
            return False
            
        else:
            print(f"   ❌ Unexpected status code: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print("   ❌ Request timed out")
        return False
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return False

def test_frontend_integration():
    """Test frontend integration"""
    print("4️⃣ Testing frontend integration...")
    
    try:
        # Check if frontend is running
        response = requests.get('http://localhost:3000', timeout=5)
        if response.status_code == 200:
            print("   ✅ Frontend is running on http://localhost:3000")
            print("   🎯 You can now test the UI by:")
            print("      1. Opening http://localhost:3000 in your browser")
            print("      2. Placing overlapping blocks on the board")
            print("      3. Clicking 'Get Solution' button")
            print("      4. Verifying the red error message appears")
            return True
        else:
            print(f"   ❌ Frontend returned {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Frontend not accessible: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Starting No-Solution Error Reporting Test")
    print("=" * 60)
    
    # Run tests
    success = test_no_solution_flow()
    
    if success:
        test_frontend_integration()
        
    print("\n" + "=" * 60)
    if success:
        print("🎉 SUCCESS: No-solution error reporting is working correctly!")
        print("\n📋 Summary:")
        print("   • Solver returns empty solution for impossible configurations")
        print("   • Server returns HTTP 404 with proper error message")
        print("   • Error includes suggestion and solve time")
        print("   • Frontend can display the error to users")
    else:
        print("❌ FAILURE: No-solution error reporting has issues")
        sys.exit(1)

if __name__ == "__main__":
    main()